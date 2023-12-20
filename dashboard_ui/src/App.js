import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import { Calendar, Envelope } from 'react-bootstrap-icons';

import './App.css';

// Placeholder function to get color based on some logic
const getColor = (period) => {
    // Check for Grey Color
    if (period.generalOnboardingComplete === '2') {
        return "#808080"; // Grey
    }

    // Check for Green Color
    if (new Date(period.startDate) + 17 * 24 * 60 * 60 * 1000 < new Date() &&
        period.studentEvaluationOfPreceptorComplete === '2' &&
        period.preceptorEvaluationSatisfactory &&
        period.aquiferCaseCompleted &&
        period.patientLogsCompleted &&
        period.failEor === '0') {
        return "#008000"; // Green
    }

    // Check for Yellow Color
    if (new Date(period.startDate) < new Date() &&
        period.studentEvaluationOfPreceptorComplete === '2' &&
        period.preceptorEvaluationNotSatisfactory &&
        period.aquiferCaseCompleted &&
        period.patientLogsCompleted &&
        period.failEor === '1') {
        return "#FFFF00"; // Yellow
    }

    // Check for Red Color
    if (new Date(period.startDate) < new Date() &&
        (period.studentEvaluationOfPreceptorComplete !== '2' ||
            !period.preceptorEvaluationSubmitted ||
            !period.aquiferCaseCompleted ||
            !period.patientLogsCompleted ||
            (period.eorRepeatScore && period.eorRepeatScore < 380))) {
        return "#FF0000"; // Red
    }

    return "#FFFFFF"; // Default white
};

const periodDates = {
    'Period 10': { start: '4/1/24', end: '4/25' },
    'Period 11': { start: '4/29', end: '5/23' },
    'Period 12': { start: '5/27', end: '6/20' },
    'Period 1': { start: '7/1', end: '7/25' },
    'Period 2': { start: '7/29', end: '8/22' },
    'Period 3': { start: '8/26', end: '9/19' },
    'Period 4': { start: '9/23', end: '10/17' },
    'Period 5': { start: '10/21', end: '11/14' },
    'Period 6': { start: '11/18', end: '12/12' },
    'Period 7': { start: '1/6/25', end: '1/30' },
    'Period 8': { start: '2/3', end: '2/27' },
    'Period 9': { start: '3/4', end: '3/28' }
};

// Data from the Excel sheet, structured as per the output we got
const studentsData = window.studentsData;

// Function to extract specialty abbreviation from record_id
const getSpecialtyFromRecordId = (recordId) => {
    const parts = recordId.split('_');
    return parts.length > 2 ? parts[2]  : "";
};

function App() {

    // Convert studentsData to an array for easier mapping and sorting
    let students = Object.keys(studentsData).map(studentKey => {
        // Extract last name from the studentKey
        const lastName = studentKey.split('_')[1].split(',')[0].trim();

        // Create an array of periods based on periodDates, filling missing data with defaults
        const studentPeriods = Object.keys(periodDates).map(periodKey => {
            const month = periodKey.split(' ')[1]; // Extract month number from periodKey
            const periodData = studentsData[studentKey].find(p => p.month === month) || {};
            return {
                ...periodData,
                specialty: periodData.record_id ? getSpecialtyFromRecordId(periodData.record_id) : '',
                locationParts: periodData.location ? periodData.location.split("_") : [],
                siteAddress: periodData.site_address || ''
            };
        });

        return {
            key: studentKey, // Include the studentKey here
            name: studentsData[studentKey]?.[0]?.full_name || "Unknown",
            lastName, // Add the extracted last name
            periods: studentPeriods
        };
    });

    // Sort the students array by last name
    students.sort((a, b) => a.lastName.localeCompare(b.lastName));

    return (
        <div className="App">
            <div className={`table-container`}>
                <table className="data-table">
                    <thead>
                    <tr>
                        <th>Student Name</th>
                        {Object.keys(periodDates).map((periodKey, index) => (
                            <th key={index}>
                                <div>{periodKey}</div>
                                <i>{periodDates[periodKey].start} - {periodDates[periodKey].end}</i>
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {students.map((student, studentIndex) => {
                        const scheduleLink  = student.periods[0]?.student_schedule;
                        const mailtoLink    = `mailto:${student.periods[0]?.email}?subject=Your 2024 - 2025 Rotation Schedule&body=See your schedule at: ${encodeURIComponent(scheduleLink)}`;

                        return(<tr key={studentIndex}>
                            <td>
                                <div>{student.name}</div>

                                {student.periods[0]?.student_schedule && (
                                    <>
                                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer">
                                            <Envelope /> Mail
                                        </a>
                                        or
                                        <a href={scheduleLink} target="_blank" rel="noopener noreferrer">
                                            <Calendar /> Link Only
                                        </a>
                                    </>
                                )}

                                {student.periods[0]?.student_url && (
                                    <a href={student.periods[0].student_url} target="_blank" rel="noopener noreferrer">
                                        <Envelope/> Email
                                    </a>
                                )}
                            </td>

                            {student.periods.map((period, index) => (
                                <td key={index} style={{backgroundColor: getColor(period)}}>
                                    <Tooltip
                                        title={period.siteAddress}
                                        position="top"
                                        key={index}
                                    >
                                        {period.locationParts.map((part, partIndex) => (
                                            <div key={partIndex}>
                                                {part}{partIndex < period.locationParts.length - 1 ? '' : ''}
                                            </div>
                                        ))}
                                    </Tooltip>
                                    {period.specialty && <em>{period.specialty}</em>}
                                </td>
                            ))}
                        </tr>
                    )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;
