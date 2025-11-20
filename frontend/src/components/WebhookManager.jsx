import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [testResults, setTestResults] = useState({});
  const [toast, setToast] = useState(null);
  const [urlError, setUrlError] = useState('');
  
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/webhooks`);
      setWebhooks(response.data);
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleAddWebhook = async (e) => {
    e.preventDefault();
    
    const trimmedUrl = newUrl.trim();
    
    if (!trimmedUrl) {
      setUrlError('Please enter a URL');
      return;
    }
    
    try {
      new URL(trimmedUrl);
    } catch {
      setUrlError('Please enter a valid URL (e.g., https://example.com/webhook)');
      return;
    }
    
    if (webhooks.some(webhook => webhook.url === trimmedUrl)) {
      setUrlError('This webhook URL already exists');
      return;
    }

    try {
      setUrlError('');
      await axios.post(`${API_URL}/webhooks`, {
        url: trimmedUrl,
        event_type: 'import.completed',
        is_active: true
      });
      
      setNewUrl('');
      showToast('✓ Webhook added successfully!', 'success');
      fetchWebhooks();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to add webhook';
      setUrlError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleDelete = async (webhookId) => {
    if (window.confirm('⚠️ Are you sure you want to delete this webhook? This action cannot be undone.')) {
      try {
        await axios.delete(`${API_URL}/webhooks/${webhookId}`);
        showToast('Webhook deleted successfully', 'success');
        fetchWebhooks();
      } catch (err) {
        showToast('Failed to delete webhook', 'error');
      }
    }
  };

  const handleTest = async (url, webhookId) => {
    setTestResults(prev => ({ ...prev, [webhookId]: { loading: true } }));
    
    try {
      const response = await axios.post(`${API_URL}/webhooks/test`, { url });
      
      setTestResults(prev => ({
        ...prev,
        [webhookId]: {
          loading: false,
          success: response.data.status === 'success',
          statusCode: response.data.status_code,
          latency: response.data.latency_ms,
          message: response.data.message
        }
      }));

      // Clear result after 5 seconds
      setTimeout(() => {
        setTestResults(prev => {
          const newResults = { ...prev };
          delete newResults[webhookId];
          return newResults;
        });
      }, 5000);
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [webhookId]: {
          loading: false,
          success: false,
          message: 'Test failed'
        }
      }));
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl border-2 animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
            : 'bg-rose-50 border-rose-500 text-rose-800'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
      
      {/* Add Webhook Form */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Webhook
        </h3>
        <form onSubmit={handleAddWebhook} className="max-w-3xl">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1 w-full">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setUrlError('');
                }}
                placeholder="https://your-webhook-url.com/endpoint"
                className={`w-full px-4 py-2.5 border ${urlError ? 'border-rose-500' : 'border-slate-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white transition-all h-[42px]`}
                required
              />
              {urlError && (
                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {urlError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 font-bold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-xl whitespace-nowrap h-[42px] flex items-center justify-center"
            >
              Add Webhook
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-slate-500">Event:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">import.completed</span>
            </div>
            <div className="h-3 w-px bg-slate-300"></div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Triggered when CSV import completes</span>
            </div>
          </div>
        </form>
      </div>

      <div className="border-t border-gray-200 pt-6">

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="p-6">
          {/* Empty State with Structure Preview */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 border-2 border-dashed border-slate-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-slate-700 mb-2">No Webhooks Configured</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Webhooks allow your system to receive real-time notifications when CSV imports complete. Add your first webhook URL above.
              </p>
            </div>
            
            {/* Enhanced Preview Structure */}
            <div className="bg-white/50 rounded-lg p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Preview Structure</div>
              
              {/* Row 1 - Most visible */}
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-300 rounded w-3/4"></div>
                  <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-7 bg-blue-300 rounded-lg shadow-sm"></div>
                  <div className="w-16 h-7 bg-rose-300 rounded-lg shadow-sm"></div>
                </div>
              </div>
              
              {/* Row 2 - Medium fade */}
              <div className="flex items-center gap-3 opacity-35">
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-300 rounded w-2/3"></div>
                  <div className="h-2 bg-slate-200 rounded w-2/5"></div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-7 bg-slate-300 rounded-lg"></div>
                  <div className="w-16 h-7 bg-slate-300 rounded-lg"></div>
                </div>
              </div>
              
              {/* Row 3 - Most faded */}
              <div className="flex items-center gap-3 opacity-20">
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-slate-300 rounded w-3/5"></div>
                  <div className="h-2 bg-slate-200 rounded w-1/3"></div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-7 bg-slate-300 rounded-lg"></div>
                  <div className="w-16 h-7 bg-slate-300 rounded-lg"></div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Test webhooks after adding</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Real-time notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Delivery tracking</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      webhook.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {webhook.event_type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 break-all font-mono">
                    {webhook.url}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Added: {new Date(webhook.created_at).toLocaleString()}
                  </p>
                  
                  {/* Test Result */}
                  {testResults[webhook.id] && (
                    <div className={`mt-2 p-2 rounded text-sm ${
                      testResults[webhook.id].loading
                        ? 'bg-blue-50 text-blue-700'
                        : testResults[webhook.id].success
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {testResults[webhook.id].loading ? (
                        <span>Testing...</span>
                      ) : (
                        <span>
                          {testResults[webhook.id].message}
                          {testResults[webhook.id].statusCode > 0 && (
                            <> • Status: {testResults[webhook.id].statusCode}</>
                          )}
                          {testResults[webhook.id].latency && (
                            <> • {testResults[webhook.id].latency}ms</>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleTest(webhook.url, webhook.id)}
                    disabled={testResults[webhook.id]?.loading}
                    className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Test webhook"
                  >
                    ⚡ Test
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 rounded-xl font-bold text-sm transition-all duration-200 shadow-md shadow-rose-500/30"
                    title="Delete webhook"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
