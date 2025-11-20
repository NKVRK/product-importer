import { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import ProductTable from './components/ProductTable'
import ProductModal from './components/ProductModal'
import WebhookManager from './components/WebhookManager'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [activeTab, setActiveTab] = useState('products')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [totalProducts, setTotalProducts] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  const handleModalSubmit = async (formData) => {
    try {
      if (editingProduct) {
        await axios.put(`${API_URL}/products/${editingProduct.id}`, formData)
      } else {
        await axios.post(`${API_URL}/products`, formData)
      }
      
      handleCloseModal()
      setRefreshTrigger(prev => prev + 1)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save product')
    }
  }

  const handleDeleteAll = async () => {
    if (window.confirm('WARNING: This will delete ALL products. This action cannot be undone. Are you sure?')) {
      try {
        await axios.delete(`${API_URL}/products/all`)
        setRefreshTrigger(prev => prev + 1)
        setTotalProducts(0)
      } catch (err) {
        alert(`Error: ${err.response?.data?.detail || err.message}`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Navigation */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 py-4">
              <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Product Importer</h1>
                <p className="text-emerald-100 text-sm">CSV Import & Webhook Management</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 h-full items-end">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-6 py-3 font-semibold transition-all duration-200 relative ${
                  activeTab === 'products'
                    ? 'text-white'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                Products
                {activeTab === 'products' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-md"></div>
                )}
              </button>
              <button
                onClick={() => !isProcessing && setActiveTab('webhooks')}
                disabled={isProcessing}
                className={`px-6 py-3 font-semibold transition-all duration-200 relative ${
                  activeTab === 'webhooks'
                    ? 'text-white'
                    : isProcessing
                    ? 'text-emerald-300 cursor-not-allowed opacity-50'
                    : 'text-emerald-100 hover:text-white'
                }`}
                title={isProcessing ? 'Please wait for file processing to complete' : ''}
              >
                Webhooks
                {isProcessing && (
                  <span className="ml-2 inline-flex items-center">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                )}
                {activeTab === 'webhooks' && !isProcessing && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-md"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Products Tab */}
          {activeTab === 'products' && (
            <>
              {/* Page Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-bold text-gray-900">Product Catalog</h2>
                    <div className="group relative">
                      <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="absolute left-0 top-8 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                        Upload CSV files to bulk import products. Supports up to 500K+ rows with real-time progress tracking.
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Product
                    </button>
                    {totalProducts > 0 && (
                      <button
                        onClick={handleDeleteAll}
                        className="inline-flex items-center px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-all shadow-sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete All
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-600">Upload and manage product data imported from CSV files</p>
              </div>

              {/* File Upload Component */}
              <FileUpload 
                onUploadComplete={handleUploadComplete}
                onProcessingChange={setIsProcessing}
              />

              {/* Product Table Component */}
              <ProductTable 
                refreshTrigger={refreshTrigger} 
                onEdit={handleEditProduct}
                onTotalChange={setTotalProducts}
              />

              {/* Product Modal */}
              <ProductModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleModalSubmit}
                initialData={editingProduct}
              />
            </>
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <>
              {/* Page Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800">Webhook Configuration</h2>
                <p className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Configure webhooks to receive real-time notifications
                </p>
              </div>
              
              <WebhookManager />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
