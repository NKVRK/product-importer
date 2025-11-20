import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export default function FileUpload({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        // Display file size info for large files
        const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
        if (selectedFile.size > 10 * 1024 * 1024) { // > 10MB
          console.log(`Large file selected: ${fileSizeMB} MB - This may take a while to process`);
        }
        setFile(selectedFile);
        setError(null);
        setStatus(null);
        setProgress(null);
      } else {
        setError('Please select a CSV file');
        setFile(null);
        e.target.value = null;
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      setError(null);
      setStatus('Uploading file...');

      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setTaskId(response.data.task_id);
      setStatus('Processing...');
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
      setUploading(false);
    }
  };

  // Poll for task status
  useEffect(() => {
    if (!taskId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/upload/status/${taskId}`);
        const data = response.data;

        setStatus(data.message);
        setProgress(data.progress);

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          setUploading(false);
          setStatus('Upload completed successfully!');
          setFile(null);
          setTaskId(null);
          
          // Notify parent component
          if (onUploadComplete) {
            onUploadComplete();
          }

          // Reset after 3 seconds
          setTimeout(() => {
            setStatus(null);
            setProgress(null);
          }, 3000);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setUploading(false);
          setError(data.error || 'Processing failed');
          setTaskId(null);
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, onUploadComplete]);

  const getProgressPercentage = () => {
    if (!progress || !progress.total) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Quick Upload</h3>
          <p className="text-sm text-slate-500">Import products from CSV file</p>
        </div>
      </div>
        
      <div className="space-y-4">
        {/* Collapsed file summary when file is selected */}
        {file && !uploading ? (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-600">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                  {file.size > 10 * 1024 * 1024 && (
                    <span className="ml-2 text-amber-600 font-semibold">• Large file</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setError(null);
                setStatus(null);
                setProgress(null);
                document.getElementById('file-upload').value = null;
              }}
              className="text-slate-500 hover:text-rose-600 transition-colors"
              title="Remove file"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-all duration-200">
              <div className="space-y-1">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex justify-center text-sm text-slate-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-slate-500 text-center">CSV files only</p>
              </div>
          </div>
        )}

        {/* Upload Button or Processing Badge */}
        {!uploading ? (
          <div className="flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file}
              className="inline-flex items-center px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold rounded-xl hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload CSV
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="relative">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <span className="text-sm font-bold text-blue-900">Processing Import</span>
            </div>
            <p className="text-xs text-center text-blue-700 font-medium">
              ⚠️ Do not close this page — processing will continue automatically
            </p>
          </div>
        )}

        {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {status && !error && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 shadow-lg">
                      {/* Stage Indicators */}
                      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="font-bold text-emerald-700 text-center">✓ Upload</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="font-bold text-emerald-700 text-center">✓ Validated</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="font-bold text-blue-700 text-center">▶ Importing</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                          <span className="font-medium text-slate-500 text-center">⏳ Finalizing</span>
                        </div>
                      </div>
                      
                      {/* Main Status */}
                      <p className="font-bold text-blue-900 mb-3 text-center">{status}</p>
                      
                      {progress && (
                        <>
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="font-semibold text-slate-700">
                                Progress: {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                              </span>
                              <span className="font-bold text-blue-600">{getProgressPercentage()}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 shadow-md"
                                style={{ width: `${getProgressPercentage()}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* ETA and Batch Info */}
                          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                            <div className="bg-white/60 rounded-lg p-2 text-center border border-blue-100">
                              <p className="text-slate-500 font-medium">Estimated Time</p>
                              <p className="text-blue-700 font-bold text-sm mt-1">~2-3 min</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2 text-center border border-blue-100">
                              <p className="text-slate-500 font-medium">Batch Progress</p>
                              <p className="text-blue-700 font-bold text-sm mt-1">
                                {Math.ceil(progress.current / 1000)} / {Math.ceil(progress.total / 1000)}
                              </p>
                            </div>
                          </div>
                          
                          {/* Info Message */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <p className="text-xs text-amber-800 text-center font-medium">
                              💡 Products will appear in the table once import completes
                            </p>
                          </div>
                        </>
                      )}
                    </div>
          )}
      </div>
    </div>
  );
}
