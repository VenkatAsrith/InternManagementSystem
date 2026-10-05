import React, { useState, useEffect } from 'react';
import { Search, User, Users, Check, MessageSquare } from 'lucide-react';
import api from '../../lib/http';
import { Button, Modal, Tabs, TabPanel, TextField, InlineAlert, LoadingBlock } from '../ui';
import { fullName } from '../../lib/format';

export function NewChatModal({ open, onClose, onCreated }) {
  const [activeTab, setActiveTab] = useState('direct');
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // Group state
  const [groupName, setGroupName] = useState('');
  const [selectedPeers, setSelectedPeers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchPeers() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/chat/peers');
        if (active) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.peers || res.data?.users || []);
          setPeers(list);
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load colleagues.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (open) {
      fetchPeers();
    }
    return () => { active = false; };
  }, [open]);

  const filteredPeers = peers.filter(p => {
    const name = `${p.firstName} ${p.lastName} ${p.email} ${p.role} ${p.department || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handleStartDirect = async (peerId) => {
    try {
      setSubmitting(true);
      const res = await api.post('/chat/conversations', {
        type: 'DIRECT',
        recipientId: peerId
      });
      onCreated(res.data?.conversation || res.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not start conversation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please provide a group name.');
      return;
    }
    if (selectedPeers.length === 0) {
      setError('Select at least one member.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/chat/conversations', {
        type: 'GROUP',
        name: groupName.trim(),
        memberIds: selectedPeers
      });
      onCreated(res.data?.conversation || res.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create group');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectPeer = (id) => {
    setSelectedPeers(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Start a Conversation"
      testId="new-chat-modal"
    >
      <div className="space-y-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}

        <Tabs
          tabs={[
            { id: 'direct', label: 'Direct Message', icon: User },
            { id: 'group', label: 'Create Group', icon: Users }
          ]}
          active={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setError(null);
          }}
        />

        <div className="relative">
          <TextField
            placeholder="Search colleagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
            data-testid="chat-peer-search"
          />
        </div>

        {loading ? (
          <LoadingBlock label="Finding accessible contacts..." />
        ) : (
          <>
            <TabPanel id="direct" active={activeTab}>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredPeers.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No matching colleagues found.</p>
                ) : (
                  filteredPeers.map(p => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition"
                      onClick={() => !submitting && handleStartDirect(p._id)}
                      data-testid={`peer-item-${p._id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                          {p.firstName?.[0]}{p.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{fullName(p)}</p>
                          <p className="text-xs text-slate-500">{p.role} {p.department ? `· ${p.department}` : ''}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" icon={MessageSquare} disabled={submitting}>
                        Chat
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabPanel>

            <TabPanel id="group" active={activeTab}>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <TextField
                  label="Group Name"
                  required
                  placeholder="e.g. Frontend Intern Cohort"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  data-testid="group-name-input"
                />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    Select Members ({selectedPeers.length} selected)
                  </label>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredPeers.map(p => {
                      const isSelected = selectedPeers.includes(p._id);
                      return (
                        <div
                          key={p._id}
                          className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer ${
                            isSelected ? 'bg-brand-50/60' : ''
                          }`}
                          onClick={() => toggleSelectPeer(p._id)}
                          data-testid={`group-peer-${p._id}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                              {p.firstName?.[0]}{p.lastName?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{fullName(p)}</p>
                              <p className="text-xs text-slate-500">{p.role}</p>
                            </div>
                          </div>
                          <div className={`h-5 w-5 rounded border flex items-center justify-center ${
                            isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} type="button">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    loading={submitting}
                    disabled={!groupName.trim() || selectedPeers.length === 0}
                    data-testid="create-group-btn"
                  >
                    Create Group
                  </Button>
                </div>
              </form>
            </TabPanel>
          </>
        )}
      </div>
    </Modal>
  );
}
