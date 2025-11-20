import { useState } from 'react'
import axios from 'axios'
import FileUpload from './components/FileUpload'
import ProductTable from './components/ProductTable'
import ProductModal from './components/ProductModal'
import WebhookManager from './components/WebhookManager'

const API_URL = 'http://localhost:8000'

function App() {
  const [activeTab, setActiveTab] = useState('products')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [totalProducts, setTotalProducts] = useState(0)

  const handleUploadComplete = () => {
    // Trigger refresh of product table
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
        // Update existing product
        await axios.put(`${API_URL}/products/${editingProduct.id}`, formData)
      } else {
        // Create new product
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
        alert('All products deleted successfully')
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete products')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Product Importer</h1>
                <p className="text-xs text-slate-500">Enterprise Dashboard</p>
              </div>
            </div>
            
            {/* Right: Navigation Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('products')}
                className={`${
                  activeTab === 'products'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Products
              </button>
              <button
                onClick={() => setActiveTab('webhooks')}
                className={`${
                  activeTab === 'webhooks'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Webhooks
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Products Tab */}
          {activeTab === 'products' && (
            <>
              {/* Page Header */}
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">Product Catalog</h2>
                  <p className="mt-2 text-sm text-slate-500 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Manage your product inventory with ease
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeleteAll}
                    disabled={totalProducts === 0}
                    className="inline-flex items-center px-5 py-2.5 bg-white text-rose-600 border-2 border-rose-200 rounded-xl hover:bg-rose-50 hover:border-rose-300 text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All
                  </button>
                  <button
                    onClick={handleAddProduct}
                    className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 text-sm font-semibold transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Product
                  </button>
                </div>
              </div>

              {/* File Upload Component */}
              <FileUpload onUploadComplete={handleUploadComplete} />

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
