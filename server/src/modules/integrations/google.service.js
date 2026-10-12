import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { GoogleIntegration } from './google.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { unprocessable, conflict } from '../../utils/errors.js';

export class GoogleIntegrationService {
  /**
   * Check if Google OAuth 2.0 environment credentials are configured
   */
  static isConfigured() {
    const missing = [];
    if (!env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
    return {
      isConfigured: missing.length === 0,
      missingConfig: missing
    };
  }

  /**
   * Get safe public status for an organization (no sensitive tokens returned)
   */
  static async getStatus(organizationId) {
    const config = this.isConfigured();
    const integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.refreshToken');

    if (!integration || !integration.isConnected || !integration.tokens?.refreshToken) {
      return {
        isConnected: false,
        isConfigured: config.isConfigured,
        missingConfig: config.missingConfig,
        accountEmail: '',
        calendarConnected: false,
        meetAvailable: false,
        lastError: integration?.lastError || '',
        connectedAt: null,
        lastRefreshedAt: null
      };
    }

    return {
      isConnected: true,
      isConfigured: config.isConfigured,
      missingConfig: config.missingConfig,
      accountEmail: integration.accountEmail || 'google.workspace@techmecha.com',
      calendarConnected: true,
      meetAvailable: true,
      lastError: integration.lastError || '',
      connectedAt: integration.connectedAt,
      lastRefreshedAt: integration.lastRefreshedAt
    };
  }

  /**
   * Generate Google OAuth 2.0 authorization URL for an organization admin
   */
  static getOAuthUrl(organizationId, userId) {
    const config = this.isConfigured();
    if (!config.isConfigured) {
      throw unprocessable(
        `Google Calendar integration is not configured on the server. Missing: ${config.missingConfig.join(', ')}`,
        [{ field: 'googleConfig', message: `Add ${config.missingConfig.join(', ')} to server/.env` }]
      );
    }

    // State payload encodes org and user context, Base64URL-encoded
    const statePayload = {
      organizationId: String(organizationId),
      userId: String(userId),
      nonce: crypto.randomBytes(8).toString('hex'),
      timestamp: Date.now()
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle OAuth 2.0 callback from Google
   */
  static async handleOAuthCallback(code, state) {
    if (!code) throw unprocessable('Missing authorization code in Google callback.');
    if (!state) throw unprocessable('Missing state parameter in Google callback.');

    let statePayload;
    try {
      statePayload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      throw unprocessable('Invalid state parameter in Google callback.');
    }

    const { organizationId, userId } = statePayload;
    if (!organizationId) throw unprocessable('State payload missing organization context.');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error(`Google token exchange error: ${tokenRes.status} ${errText}`);
      throw unprocessable(`Google token exchange failed: status ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile to get authorized Google account email
    let accountEmail = '';
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        accountEmail = (userData.email || '').toLowerCase().trim();
      }
    } catch (e) {
      logger.warn('Failed to fetch user email during Google OAuth:', e);
    }

    let integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.accessToken +tokens.refreshToken +tokens.expiryDate');

    if (!integration) {
      integration = new GoogleIntegration({ organizationId });
    }

    integration.isConnected = true;
    integration.accountEmail = accountEmail || 'google.workspace@techmecha.com';
    integration.scope = (tokenData.scope || '').split(' ').filter(Boolean);
    integration.calendarId = env.GOOGLE_CALENDAR_ID || 'primary';
    integration.meetAvailable = true;
    integration.connectedBy = userId;
    integration.connectedAt = new Date();
    integration.lastRefreshedAt = new Date();
    integration.lastError = '';
    integration.tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || integration.tokens?.refreshToken || '',
      expiryDate: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
      tokenType: tokenData.token_type || 'Bearer'
    };

    await integration.save();
    logger.info(`Google Workspace connected successfully for org ${organizationId} (account: ${integration.accountEmail})`);
    return integration.toSafeStatus();
  }

  /**
   * Ensure fresh access token using refresh token
   */
  static async ensureValidAccessToken(integration) {
    if (!integration.tokens?.refreshToken) {
      integration.isConnected = false;
      integration.lastError = 'Missing refresh token. Reconnection required.';
      await integration.save();
      throw conflict('Google Calendar authorization is incomplete. Please reconnect your Google account.', 'GOOGLE_NOT_CONNECTED');
    }

    // If access token is valid for at least 60 seconds, reuse it
    if (integration.tokens.accessToken && integration.tokens.expiryDate && new Date(integration.tokens.expiryDate).getTime() > Date.now() + 60000) {
      return integration.tokens.accessToken;
    }

    // Refresh token exchange
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: integration.tokens.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshRes.ok) {
        const errText = await refreshRes.text();
        logger.error(`Google token refresh failed: ${refreshRes.status} ${errText}`);
        integration.isConnected = false;
        integration.lastError = 'Google authorization revoked or expired. Please reconnect.';
        await integration.save();
        throw conflict('Google Calendar authorization expired or was revoked. Please reconnect your Google account.', 'GOOGLE_REVOKED');
      }

      const refreshed = await refreshRes.json();
      integration.tokens.accessToken = refreshed.access_token;
      integration.tokens.expiryDate = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
      integration.lastRefreshedAt = new Date();
      integration.lastError = '';
      await integration.save();

      return refreshed.access_token;
    } catch (err) {
      if (err.statusCode === 409) throw err;
      throw conflict(`Unable to refresh Google access token: ${err.message}`, 'GOOGLE_REFRESH_FAILED');
    }
  }

  /**
   * Disconnect Google Workspace
   */
  static async disconnect(organizationId) {
    const integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.accessToken +tokens.refreshToken +tokens.expiryDate');

    if (integration) {
      integration.isConnected = false;
      integration.tokens = {
        accessToken: '',
        refreshToken: '',
        expiryDate: null,
        tokenType: 'Bearer'
      };
      integration.meetAvailable = false;
      integration.lastError = '';
      await integration.save();
    }

    logger.info(`Google Workspace disconnected for org ${organizationId}`);
    return { isConnected: false, calendarConnected: false, meetAvailable: false };
  }

  /**
   * Create real Google Calendar Event with a genuine Google Meet conference
   */
  static async createCalendarAndMeetEvent({
    organizationId,
    title,
    description = '',
    scheduledDate,
    startTime,
    endTime,
    timezone = 'Asia/Kolkata',
    attendees = [],
    requestId
  }) {
    const config = this.isConfigured();
    if (!config.isConfigured) {
      throw conflict(
        `Google Meet integration is not configured on the server. Please configure ${config.missingConfig.join(', ')} in server/.env and connect an authorized Google account.`,
        'GOOGLE_NOT_CONFIGURED'
      );
    }

    const integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.accessToken +tokens.refreshToken +tokens.expiryDate');

    if (!integration || !integration.isConnected || !integration.tokens?.refreshToken) {
      throw conflict(
        'Google Workspace account is not connected. Please click "Connect Google Calendar" in Settings or Meetings before creating a Google Meet meeting.',
        'GOOGLE_NOT_CONNECTED'
      );
    }

    const accessToken = await this.ensureValidAccessToken(integration);

    try {
      // Build start and end ISO timestamps with timezone
      const dateStr = typeof scheduledDate === 'string' ? scheduledDate.slice(0, 10) : scheduledDate.toISOString().slice(0, 10);
      const startDateTimeStr = `${dateStr}T${startTime}:00`;
      const endDateTimeStr = `${dateStr}T${endTime}:00`;

      const calendarId = integration.calendarId || env.GOOGLE_CALENDAR_ID || 'primary';
      const eventPayload = {
        summary: title,
        description,
        start: { dateTime: new Date(startDateTimeStr).toISOString(), timeZone: timezone },
        end: { dateTime: new Date(endDateTimeStr).toISOString(), timeZone: timezone },
        attendees: attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: requestId || uuidv4(),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventPayload)
        }
      );

      if (!calRes.ok) {
        const errBody = await calRes.text();
        logger.error(`Google Calendar API error: ${calRes.status} ${errBody}`);
        throw new Error(`Google Calendar API failed with status ${calRes.status}: ${errBody}`);
      }

      const data = await calRes.json();
      const meetLink = data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || data.hangoutLink;

      if (!meetLink) {
        const confStatus = data.conferenceData?.createRequest?.status?.statusCode;
        if (confStatus === 'pending') {
          logger.warn(`Google Meet conference creation is pending for event ${data.id}`);
          return {
            eventId: data.id,
            meetLink: data.htmlLink,
            conferenceId: data.conferenceData?.conferenceId || data.id,
            htmlLink: data.htmlLink,
            conferencePending: true
          };
        }
        throw new Error('Google Calendar event was created, but no video conference link was generated.');
      }

      return {
        eventId: data.id,
        meetLink,
        conferenceId: data.conferenceData?.conferenceId || data.id,
        htmlLink: data.htmlLink
      };
    } catch (err) {
      integration.lastError = err.message || 'Google API error';
      await integration.save();
      logger.error('Google Meet scheduling error:', err);
      throw unprocessable(
        `Unable to create real Google Meet meeting: ${err.message}. Please retry or check Google account permissions.`,
        [{ field: 'googleMeet', message: err.message }]
      );
    }
  }

  /**
   * Reschedule an existing Google Calendar Event
   */
  static async updateCalendarEvent({
    organizationId,
    eventId,
    scheduledDate,
    startTime,
    endTime,
    timezone = 'Asia/Kolkata',
    attendees = []
  }) {
    if (!eventId) return null;
    const integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.accessToken +tokens.refreshToken +tokens.expiryDate');

    if (!integration || !integration.isConnected || !integration.tokens?.refreshToken) return null;

    try {
      const accessToken = await this.ensureValidAccessToken(integration);
      const calendarId = integration.calendarId || env.GOOGLE_CALENDAR_ID || 'primary';
      const dateStr = typeof scheduledDate === 'string' ? scheduledDate.slice(0, 10) : scheduledDate.toISOString().slice(0, 10);
      const startDateTimeStr = `${dateStr}T${startTime}:00`;
      const endDateTimeStr = `${dateStr}T${endTime}:00`;

      const updatePayload = {
        start: { dateTime: new Date(startDateTimeStr).toISOString(), timeZone: timezone },
        end: { dateTime: new Date(endDateTimeStr).toISOString(), timeZone: timezone }
      };
      if (attendees.length > 0) {
        updatePayload.attendees = attendees.map(email => ({ email }));
      }

      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatePayload)
        }
      );

      if (!patchRes.ok) {
        logger.warn(`Google Calendar event update returned status ${patchRes.status}`);
      }

      logger.info(`Google Calendar event ${eventId} updated to date ${scheduledDate} from ${startTime} to ${endTime}`);
      return { eventId, updated: true };
    } catch (err) {
      logger.error(`Error updating Google Calendar event ${eventId}:`, err);
      return null;
    }
  }

  /**
   * Cancel / delete an existing Google Calendar Event
   */
  static async cancelCalendarEvent({ organizationId, eventId }) {
    if (!eventId) return null;
    const integration = await GoogleIntegration.findOne({ organizationId })
      .select('+tokens.accessToken +tokens.refreshToken +tokens.expiryDate');

    if (!integration || !integration.isConnected || !integration.tokens?.refreshToken) return null;

    try {
      const accessToken = await this.ensureValidAccessToken(integration);
      const calendarId = integration.calendarId || env.GOOGLE_CALENDAR_ID || 'primary';

      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
        logger.warn(`Google Calendar event deletion returned status ${delRes.status}`);
      }

      logger.info(`Google Calendar event ${eventId} deleted successfully`);
      return { eventId, cancelled: true };
    } catch (err) {
      logger.error(`Error deleting Google Calendar event ${eventId}:`, err);
      return null;
    }
  }
}
