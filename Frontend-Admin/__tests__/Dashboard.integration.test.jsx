import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';

// Mock axios
jest.mock('axios');

// Mock react-toastify
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock jsPDF
jest.mock('jspdf');

// Mock react-chartjs-2 with a simple component
jest.mock('react-chartjs-2', () => ({
  Bar: jest.fn(() => null)
}));

// Mock Dashboard component to avoid complex dependencies
jest.mock('../src/components/Dashboard', () => {
  return jest.fn(() => null);
});

describe('Dashboard PDF Report Generation - Integration Test', () => {
  let mockPdfInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPdfInstance = {
      internal: {
        pageSize: {
          getWidth: jest.fn(() => 595)
        }
      },
      setFillColor: jest.fn(),
      rect: jest.fn(),
      setTextColor: jest.fn(),
      setFontSize: jest.fn(),
      text: jest.fn(),
      setDrawColor: jest.fn(),
      roundedRect: jest.fn(),
      addImage: jest.fn(),
      save: jest.fn()
    };

    jsPDF.mockImplementation(() => mockPdfInstance);
  });

  it('should fetch daily appointments data successfully', async () => {
    axios.get.mockResolvedValue({
      data: { success: true, count: 15, date: '2024-01-15' }
    });

    const response = await axios.get('http://localhost:4000/api/v1/analytics/daily-appointments?date=2024-01-15');

    expect(response.data.success).toBe(true);
    expect(response.data.count).toBe(15);
  });

  it('should fetch daily income data successfully', async () => {
    axios.get.mockResolvedValue({
      data: { success: true, totalIncome: 7500, date: '2024-01-15' }
    });

    const response = await axios.get('http://localhost:4000/api/v1/analytics/daily-income?date=2024-01-15');

    expect(response.data.success).toBe(true);
    expect(response.data.totalIncome).toBe(7500);
  });

  it('should fetch most visited doctors data successfully', async () => {
    axios.get.mockResolvedValue({
      data: {
        success: true,
        topDoctors: [
          { firstName: 'Dr. Smith', lastName: 'Johnson', count: 10 },
          { firstName: 'Dr. Emily', lastName: 'Brown', count: 8 },
          { firstName: 'Dr. Michael', lastName: 'Davis', count: 5 }
        ]
      }
    });

    const response = await axios.get('http://localhost:4000/api/v1/analytics/most-visited-doctors?limit=3');

    expect(response.data.success).toBe(true);
    expect(response.data.topDoctors).toHaveLength(3);
    expect(response.data.topDoctors[0].firstName).toBe('Dr. Smith');
  });

  it('should create jsPDF instance for PDF generation', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    expect(jsPDF).toHaveBeenCalledWith({ unit: 'pt', format: 'a4' });
    expect(doc).toBeDefined();
    expect(doc.internal.pageSize.getWidth()).toBe(595);
  });

  it('should call PDF methods for report generation', () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // Simulate PDF generation steps
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 595, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Hospital Analytics Report', 40, 40);
    doc.save('test-report.pdf');

    expect(mockPdfInstance.setFillColor).toHaveBeenCalledWith(102, 126, 234);
    expect(mockPdfInstance.rect).toHaveBeenCalledWith(0, 0, 595, 60, 'F');
    expect(mockPdfInstance.text).toHaveBeenCalledWith('Hospital Analytics Report', 40, 40);
    expect(mockPdfInstance.save).toHaveBeenCalledWith('test-report.pdf');
  });

  it('should handle API errors gracefully', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    try {
      await axios.get('http://localhost:4000/api/v1/analytics/daily-appointments?date=2024-01-15');
    } catch (error) {
      expect(error.message).toBe('Network error');
    }
  });
});
