import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function FileUpload({ onUploadComplete, onProcessingChange }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const uploadCompleteRef = useRef(onUploadComplete);
  const processingRef = useRef(onProcessingChange);

  useEffect(() => {
    uploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  useEffect(() => {
    processingRef.current = onProcessingChange;
  }, [onProcessingChange]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
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
    if (onProcessingChange) {
      onProcessingChange(true);
    }
    
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
      
      if (onProcessingChange) {
        onProcessingChange(false);
      }
    }
  };

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

          if (processingRef.current) {
            processingRef.current(false);
          }

          if (uploadCompleteRef.current) {
            uploadCompleteRef.current();
          }

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
        // Silently handle polling errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [taskId]);

  const getProgressPercentage = () => {
    if (!progress || !progress.total || progress.total === 0) return 0;
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
          <div className="border-3 border-dashed border-slate-400 rounded-2xl p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-md transition-all duration-200">
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
                <div className="mt-2 px-3 py-1 bg-slate-100 rounded-md inline-block">
                  <p className="text-xs font-semibold text-slate-700">📄 CSV files only</p>
                </div>
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
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              {/* Stage 1: Upload */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-emerald-700">Upload</span>
              </div>

              <div className="flex-1 h-1 bg-emerald-500 mx-2 rounded"></div>

              {/* Stage 2: Validated */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-emerald-700">Validated</span>
              </div>

              <div className={`flex-1 h-1 mx-2 rounded ${progress ? 'bg-blue-500' : 'bg-slate-300'}`}></div>

              {/* Stage 3: Importing */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  progress ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-300 text-slate-500'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className={`text-xs font-semibold ${progress ? 'text-blue-700' : 'text-slate-500'}`}>Importing</span>
              </div>

              <div className="flex-1 h-1 bg-slate-300 mx-2 rounded"></div>

              {/* Stage 4: Complete */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-300 text-slate-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-500">Complete</span>
              </div>
            </div>
            
            {progress && (
              <div className="mt-4">
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-700">
                      {progress?.total > 0 
                        ? `Progress: ${progress?.current?.toLocaleString() || 0} / ${progress?.total?.toLocaleString() || 0}`
                        : `Processed: ${progress?.current?.toLocaleString() || 0} products`
                      }
                    </span>
                    {progress?.total > 0 && (
                      <span className="font-bold text-blue-600">{getProgressPercentage()}%</span>
                    )}
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
                      {Math.ceil((progress?.current || 0) / 1000)} / {Math.ceil((progress?.total || 0) / 1000)}
                    </p>
                  </div>
                </div>
                
                {/* Info Message */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-xs text-amber-800 text-center font-medium">
                    💡 Products will appear in the table once import completes
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
