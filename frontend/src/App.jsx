import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ProductTable from './components/ProductTable'

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleUploadComplete = () => {
    // Trigger refresh of product table
    setRefreshTrigger(prev => prev + 1)
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

        {/* File Upload Component */}
        <FileUpload onUploadComplete={handleUploadComplete} />

        {/* Product Table Component */}
        <ProductTable refreshTrigger={refreshTrigger} />
      </div>
    </div>
  )
}

export default App
