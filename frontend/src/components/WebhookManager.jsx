import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [testResults, setTestResults] = useState({});

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
    
    if (!newUrl.trim()) {
      alert('Please enter a URL');
      return;
    }

    try {
      await axios.post(`${API_URL}/webhooks`, {
        url: newUrl,
        event_type: 'import.completed',
        is_active: true
      });
      
      setNewUrl('');
      fetchWebhooks();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add webhook');
    }
  };

  const handleDelete = async (webhookId) => {
    if (window.confirm('Are you sure you want to delete this webhook?')) {
      try {
        await axios.delete(`${API_URL}/webhooks/${webhookId}`);
        fetchWebhooks();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete webhook');
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Webhook Configuration</h2>
      
      <p className="text-gray-600 mb-6">
        Configure webhooks to receive notifications when imports are completed.
      </p>

      {/* Add Webhook Form */}
      <form onSubmit={handleAddWebhook} className="mb-8">
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://your-webhook-url.com/endpoint"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors"
          >
            Add Webhook
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Event: <span className="font-medium">import.completed</span>
        </p>
      </form>

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No webhooks configured yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add a webhook URL above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
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
                    className="text-blue-600 hover:text-blue-900 font-medium text-sm disabled:opacity-50"
                    title="Test webhook"
                  >
                    ⚡ Test
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="text-red-600 hover:text-red-900 font-medium text-sm"
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
  );
}
