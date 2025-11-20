import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FileUpload from '../FileUpload';
import axios from 'axios';

vi.mock('axios');

describe('FileUpload Component', () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnProcessingChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload area', () => {
    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    expect(screen.getByText(/Upload a file/i)).toBeInTheDocument();
    expect(screen.getByText(/CSV files only/i)).toBeInTheDocument();
  });

  it('shows error for non-CSV file', () => {
    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Upload a file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText(/Please select a CSV file/i)).toBeInTheDocument();
  });

  it('accepts CSV file', () => {
    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const file = new File(['sku,name,description'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload a file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText(/test.csv/i)).toBeInTheDocument();
  });

  it('uploads file successfully', async () => {
    axios.post.mockResolvedValue({
      data: { task_id: '123', status: 'processing' }
    });

    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const file = new File(['sku,name,description'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload a file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    const uploadButton = screen.getByText(/Upload CSV/i);
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(mockOnProcessingChange).toHaveBeenCalledWith(true);
      expect(axios.post).toHaveBeenCalled();
    });
  });

  it('handles upload error', async () => {
    axios.post.mockRejectedValue({
      response: { data: { detail: 'Upload failed' } }
    });

    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const file = new File(['sku,name,description'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload a file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    const uploadButton = screen.getByText(/Upload CSV/i);
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
      expect(mockOnProcessingChange).toHaveBeenCalledWith(false);
    });
  });

  it('disables upload button when no file selected', () => {
    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const uploadButton = screen.getByText(/Upload CSV/i);
    expect(uploadButton).toBeDisabled();
  });

  it('shows processing state during upload', async () => {
    axios.post.mockResolvedValue({
      data: { task_id: '123', status: 'processing' }
    });

    render(
      <FileUpload 
        onUploadComplete={mockOnUploadComplete}
        onProcessingChange={mockOnProcessingChange}
      />
    );
    
    const file = new File(['sku,name,description'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload a file/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    const uploadButton = screen.getByText(/Upload CSV/i);
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Processing Import/i)).toBeInTheDocument();
    });
  });
});
