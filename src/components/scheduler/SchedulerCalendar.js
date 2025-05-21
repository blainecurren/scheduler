import React, { useState } from "react";
import "./SchedulerCalendar.css";

const SchedulerCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper function to get days in month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get day of week of first day in month
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
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

      calendarDays.push(
        <div
          key={day}
          className={`calendar-day ${isSelected ? "selected" : ""} ${
            isToday ? "today" : ""
          }`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="day-number">{day}</div>
          <div className="appointments-indicator">
            {/* This would show appointment indicators */}
            {Math.random() > 0.7 && <div className="appointment-dot"></div>}
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

  // Format month and year for display
  const formatMonthYear = (date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="scheduler-container">
      <div className="calendar-header">
        <h2>Appointment Calendar</h2>
        <div className="calendar-navigation">
          <button onClick={prevMonth} className="nav-button">
            &lt;
          </button>
          <h3>{formatMonthYear(currentMonth)}</h3>
          <button onClick={nextMonth} className="nav-button">
            &gt;
          </button>
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
        <h3>Appointments for {selectedDate.toLocaleDateString()}</h3>
        <div className="appointment-list">
          <p>No appointments scheduled for this date.</p>
          {/* This would show actual appointments when implemented */}
        </div>
      </div>
    </div>
  );
};

export default SchedulerCalendar;
