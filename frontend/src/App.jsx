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
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Product Importer</h1>
          <p className="mt-2 text-gray-600">
            Upload and manage your product catalog with ease
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('products')}
              className={`${
                activeTab === 'products'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Products View
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`${
                activeTab === 'webhooks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Webhooks Config
            </button>
          </nav>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <>
            {/* Action Buttons */}
            <div className="mb-6 flex justify-end gap-3">
              <button
                onClick={handleAddProduct}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium transition-colors"
              >
                + Add Product
              </button>
              <button
                onClick={handleDeleteAll}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-medium transition-colors"
              >
                Delete All
              </button>
            </div>

            {/* File Upload Component */}
            <FileUpload onUploadComplete={handleUploadComplete} />

            {/* Product Table Component */}
            <ProductTable 
              refreshTrigger={refreshTrigger} 
              onEdit={handleEditProduct}
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
          <WebhookManager />
        )}
      </div>
    </div>
  )
}

export default App
