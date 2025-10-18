import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Loading from "./loading";
import "./Dashboard.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Reports = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const [dailyAppointments, setDailyAppointments] = useState(null);
  const [dailyIncome, setDailyIncome] = useState(null);
  const [topDoctors, setTopDoctors] = useState([]);

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const chartRef = useRef(null);
  const kpiRef = useRef(null);

  const fetchDailyAppointments = async (date) => {
    const { data } = await axios.get(`http://localhost:4000/api/v1/analytics/daily-appointments`, {
      params: { date },
      withCredentials: true,
    });
    return data;
  };

  const fetchDailyIncome = async (date) => {
    const { data } = await axios.get(`http://localhost:4000/api/v1/analytics/daily-income`, {
      params: { date },
      withCredentials: true,
    });
    return data;
  };

  const fetchTopDoctors = async (start, end, limit = 3) => {
    const { data } = await axios.get(`http://localhost:4000/api/v1/analytics/most-visited-doctors`, {
      params: { start, end, limit },
      withCredentials: true,
    });
    return data;
  };

  const generatePDF = async () => {
    try {
      setPdfLoading(true);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 40;

      // Header
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, pageWidth, 60, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Hospital Analytics Report", 40, 40);

      // Meta
      doc.setTextColor(60, 72, 88);
      doc.setFontSize(12);
      y = 90;
      doc.text(`Daily Date: ${selectedDate}`, 40, y);
      doc.text(`Range: ${rangeStart} → ${rangeEnd}`, 300, y);

      // KPI cards snapshot (optional): render a mini block
      y += 30;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(40, y, pageWidth - 80, 70, 6, 6, "FD");
      doc.setFontSize(14);
      doc.setTextColor(45, 55, 72);
      doc.text(`Daily Appointments: ${dailyAppointments ?? '-'}`, 60, y + 28);
      doc.text(`Daily Income: ${dailyIncome ?? 0}`, 60, y + 50);

      // Chart image
      y += 100;
      if (chartRef.current) {
        const chart = chartRef.current;
        // react-chartjs-2 exposes ChartJS instance via chartRef.current
        const canvas = chart.canvas || chart?.ctx?.canvas || (chart?.chart && chart.chart.canvas);
        if (canvas) {
          const canvasImg = canvas.toDataURL("image/png", 1.0);
          const imgWidth = pageWidth - 80;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          doc.setFontSize(14);
          doc.setTextColor(45, 55, 72);
          doc.text("Most Visited Doctors", 40, y);
          y += 12;
          doc.addImage(canvasImg, "PNG", 40, y, imgWidth, imgHeight);
          y += imgHeight + 20;
        }
      }

      // Top doctors list (fallback textual summary)
      if (topDoctors && topDoctors.length) {
        doc.setFontSize(12);
        doc.text("Top Doctors (Name - Visits)", 40, y);
        y += 16;
        topDoctors.forEach((d, i) => {
          doc.text(`${i + 1}. ${d.firstName} ${d.lastName} - ${d.count}`, 40, y);
          y += 16;
        });
      }

      doc.save(`analytics-report-${rangeStart}_to_${rangeEnd}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF report");
    } finally {
      setPdfLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const [apps, income, doctors] = await Promise.all([
        fetchDailyAppointments(selectedDate),
        fetchDailyIncome(selectedDate),
        fetchTopDoctors(rangeStart, rangeEnd, 3),
      ]);
      setDailyAppointments(apps?.count ?? 0);
      setDailyIncome(income?.totalIncome ?? 0);
      setTopDoctors(doctors?.topDoctors ?? []);
    } catch (err) {
      console.error("loadReports error:", err);
      toast.error(err.response?.data?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefreshClick = (e) => {
    e.preventDefault();
    loadReports();
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>Analytics Reports</h1>
        <p>Daily KPIs and Top Doctors</p>
      </div>

      <form onSubmit={onRefreshClick} className="analytics-form">
        <div className="analytics-grid">
          <div className="form-field">
            <label>Daily Date</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Range Start</label>
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Range End</label>
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={generatePDF}
              disabled={pdfLoading}
              style={{ marginLeft: 8 }}
              aria-label="Generate PDF report"
            >
              {pdfLoading ? "Generating PDF..." : "Generate PDF"}
            </button>
          </div>
        </div>
      </form>

      {loading && <Loading />}

      <section className="kpi-cards" ref={kpiRef}>
        <div className="kpi-card">
          <div className="kpi-title">Daily Appointments</div>
          <div className="kpi-value">{dailyAppointments ?? "-"}</div>
          <div className="kpi-sub">{selectedDate}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Daily Income</div>
          <div className="kpi-value">{dailyIncome != null ? `₹ ${dailyIncome}` : "-"}</div>
          <div className="kpi-sub">{selectedDate}</div>
        </div>
      </section>

      <section className="charts-section">
        <div className="chart-card">
          <div className="chart-header">
            <h3>Most Visited Doctors {rangeStart && rangeEnd ? `(${rangeStart} → ${rangeEnd})` : ""}</h3>
          </div>
          {topDoctors.length === 0 ? (
            <div className="empty-chart">No data</div>
          ) : (
            <Bar
              ref={chartRef}
              data={{
                labels: topDoctors.map((d) => `${d.firstName} ${d.lastName}`),
                datasets: [
                  {
                    label: "Visits",
                    data: topDoctors.map((d) => d.count),
                    backgroundColor: "rgba(99, 102, 241, 0.7)",
                    borderRadius: 6,
                    maxBarThickness: 20,
                    categoryPercentage: 0.55,
                    barPercentage: 0.55,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: true, position: "top" },
                  title: { display: false },
                },
                scales: {
                  x: { ticks: { color: "#475569", maxRotation: 0, minRotation: 0, padding: 6 } },
                  y: { ticks: { color: "#475569", stepSize: 1 }, beginAtZero: true, precision: 0 },
                },
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default Reports;