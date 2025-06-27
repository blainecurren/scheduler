import React, { useState, useEffect } from "react";
import useAPIClient from "../../hooks/apiClient";
import "./SchedulerCalendar.css";

const SchedulerCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [selectedDateAppointments, setSelectedDateAppointments] = useState([]);
  const [selectedNurse, setSelectedNurse] = useState("");
  const [nurses, setNurses] = useState([]);

  const { 
    loading, 
    error, 
    getCalendarData, 
    getFilterOptions,
    clearError 
  } = useAPIClient();

  // Load nurses for filtering
  useEffect(() => {
    const loadNurses = async () => {
      try {
        const options = await getFilterOptions();
        if (options?.nurses) {
          setNurses(options.nurses);
        }
      } catch (err) {
        console.error("Error loading nurses:", err);
      }
    };

    loadNurses();
  }, [getFilterOptions]);

  // Load calendar data when month or nurse filter changes
  useEffect(() => {
    const loadCalendarData = async () => {
      try {
        clearError();
        
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        // Get first and last day of the month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const filters = {
          dateFrom: firstDay.toISOString().split('T')[0],
          dateTo: lastDay.toISOString().split('T')[0]
        };

        // Add nurse filter if selected
        if (selectedNurse) {
          filters.nurses = selectedNurse;
        }

        const data = await getCalendarData(filters);
        setCalendarData(data.appointmentsByDate || {});

      } catch (err) {
        console.error("Error loading calendar data:", err);
      }
    };

    loadCalendarData();
  }, [currentMonth, selectedNurse, getCalendarData, clearError]);

  // Load appointments for selected date
  useEffect(() => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    const dayAppointments = calendarData[dateKey] || [];
    setSelectedDateAppointments(dayAppointments);
  }, [selectedDate, calendarData]);

  // Helper function to get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get day of week of first day in month
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  // Get appointment count for a specific date
  const getAppointmentCount = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    return calendarData[dateKey]?.length || 0;
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);

    const calendarDays = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(
        <div key={`empty-${i}`} className="calendar-day empty"></div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = date.toDateString() === selectedDate.toDateString();
      const isToday = date.toDateString() === new Date().toDateString();
      const appointmentCount = getAppointmentCount(date);

      calendarDays.push(
        <div
          key={day}
          className={`calendar-day ${isSelected ? "selected" : ""} ${
            isToday ? "today" : ""
          } ${appointmentCount > 0 ? "has-appointments" : ""}`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="day-number">{day}</div>
          <div className="appointments-indicator">
            {appointmentCount > 0 && (
              <div className="appointment-count">
                {appointmentCount}
              </div>
            )}
          </div>
        </div>
      );
    }

    return calendarDays;
  };

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  // Navigate to today
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  // Format month and year for display
  const formatMonthYear = (date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      let date;
      if (dateString.includes('/')) {
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }
      
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return dateString;
    }
  };

  return (
    <div className="scheduler-container">
      <div className="calendar-header">
        <h2>Appointment Calendar</h2>
        
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <button onClick={clearError} className="error-dismiss">×</button>
          </div>
        )}

        <div className="calendar-controls">
          <div className="nurse-filter">
            <label htmlFor="nurseFilter">Filter by Nurse:</label>
            <select
              id="nurseFilter"
              value={selectedNurse}
              onChange={(e) => setSelectedNurse(e.target.value)}
              className="nurse-select"
            >
              <option value="">All Nurses</option>
              {nurses.map(nurse => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="calendar-navigation">
            <button onClick={prevMonth} className="nav-button">
              ‹ Prev
            </button>
            <h3>{formatMonthYear(currentMonth)}</h3>
            <button onClick={nextMonth} className="nav-button">
              Next ›
            </button>
            <button onClick={goToToday} className="today-button">
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-grid">
        {/* Weekdays header */}
        <div className="weekday">Sun</div>
        <div className="weekday">Mon</div>
        <div className="weekday">Tue</div>
        <div className="weekday">Wed</div>
        <div className="weekday">Thu</div>
        <div className="weekday">Fri</div>
        <div className="weekday">Sat</div>

        {/* Calendar days */}
        {generateCalendarDays()}
      </div>

      <div className="selected-date-info">
        <div className="date-header">
          <h3>
            Appointments for {selectedDate.toLocaleDateString()}
            {selectedNurse && nurses.find(n => n.id === selectedNurse) && 
              ` - ${nurses.find(n => n.id === selectedNurse).name}`
            }
          </h3>
          {loading && <span className="loading-text">Loading...</span>}
        </div>

        <div className="appointment-list">
          {selectedDateAppointments.length === 0 ? (
            <div className="no-appointments">
              <p>No appointments scheduled for this date.</p>
              {selectedNurse && (
                <p>Try viewing all nurses or selecting a different date.</p>
              )}
            </div>
          ) : (
            <div className="appointments">
              {selectedDateAppointments.map((appointment, index) => (
                <div key={`${appointment.id}-${index}`} className="appointment-item">
                  <div className="appointment-time">
                    {formatTime(appointment.startDate)}
                  </div>
                  <div className="appointment-details">
                    <div className="patient-name">
                      <strong>{appointment.patientName}</strong>
                    </div>
                    <div className="nurse-name">
                      👩‍⚕️ {appointment.nurseName}
                    </div>
                    <div className="service-type">
                      🏥 {appointment.serviceType}
                    </div>
                    <div className="location">
                      📍 {appointment.locationName}
                    </div>
                    <div className="status">
                      <span className={`status-badge ${appointment.status?.toLowerCase()}`}>
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDateAppointments.length > 0 && (
          <div className="date-summary">
            <p>
              <strong>{selectedDateAppointments.length}</strong> appointments scheduled
            </p>
            {selectedNurse ? (
              <p>Filtered by: {nurses.find(n => n.id === selectedNurse)?.name}</p>
            ) : (
              <p>Showing all nurses</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerCalendar;