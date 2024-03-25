import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import { Calendar, Envelope, FileEarmarkText, ClipboardData, ListCheck, GraphUp } from 'react-bootstrap-icons';

import './App.css';

const getCssClassForRotation = (rotationData, isAdminView) => {
    if (!isAdminView) {
        return ''; // Non-admins do not see colors
    }

    // Deconstruct only the properties we need
    const {
        site_confirmation_complete,
        student_evaluation_of_preceptor_complete,
        preceptor_evals = [],
        communication_forms_complete,
        patient_log_complete,
        fail_eor,
        eor_repeat_score,
        start_date,
        specialty,
        // Assuming '1' signifies a complete Aquifer case and '2' signifies a complete preceptor evaluation
        aquifer302 = '',
        aquifer304 = '',
        aquifer311 = '',
        aquifer_other = '',
    } = rotationData;

    // Convert start_date to Date object
    const today = new Date();
    const startDate = new Date(start_date);
    const rotationEnd = new Date(startDate);
    rotationEnd.setDate(rotationEnd.getDate() + 17); // Add 17 days to start date

    // Determine if any preceptor evaluations are complete
    const hasCompletePreceptorEvaluation = preceptor_evals.some(evaluation =>
        evaluation.internal_medicine_i_complete === '2' ||
        evaluation.internal_medicine_ii_complete === '2' ||
        evaluation.primary_care_i_complete === '2' ||
        evaluation.primary_care_ii_complete === '2' ||
        evaluation.pediatrics_complete === '2' ||
        evaluation.surgery_complete === '2' ||
        evaluation.emergency_medicine_complete === '2' ||
        evaluation.womens_health_complete === '2' ||
        evaluation.behavioral_medicine_complete === '2' ||
        evaluation.electives_complete === '2'
    );

    // Determine if any Aquifer cases are complete
    const hasCompleteAquiferCase = aquifer302 === '1' ||
        aquifer304 === '1' ||
        aquifer311 === '1' ||
        aquifer_other === '1' ||
        specialty === 'SURG' ||
        specialty === 'ELV'; // These specialties don't require Aquifer cases

    // Apply logic based on conditions document
    if (site_confirmation_complete === '2') {
        return 'bg_complete'; // Grey
    }

    // console.log('bg_rotationend:' + rotationData.start_date, rotationEnd < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, communication_forms_complete, hasCompleteAquiferCase, patient_log_complete, fail_eor);

    if (rotationEnd < today &&
        student_evaluation_of_preceptor_complete === '2' &&
        hasCompletePreceptorEvaluation &&
        // Placeholder for overall_evaluation_score condition - need further data or calculation method
        communication_forms_complete === '2' &&
        hasCompleteAquiferCase &&
        patient_log_complete === '2' &&
        fail_eor === '0'
    ) {
        return 'bg_rotationend'; // Green
    }

    console.log('bg_rotationongoing:' + rotationData.start_date, startDate < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, hasCompleteAquiferCase, patient_log_complete, communication_forms_complete, fail_eor);

    if (startDate < today &&
        (student_evaluation_of_preceptor_complete === '2' &&
            hasCompletePreceptorEvaluation &&
            hasCompleteAquiferCase &&
            patient_log_complete === '2') &&
        // Placeholder for overall_evaluation_score condition - need further data or calculation method
        // Assuming overall_evaluation_score < 3 is a placeholder for not satisfactory evaluation
        (communication_forms_complete !== '2')

            || (fail_eor === '1')
    ) {
        return 'bg_rotationongoing'; // Yellow
    }

    console.log('bg_rotationstart:' + rotationData.start_date, startDate < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, hasCompleteAquiferCase, patient_log_complete, eor_repeat_score, eor_repeat_score);
    if (startDate < today &&
        (student_evaluation_of_preceptor_complete !== '2' ||
            !hasCompletePreceptorEvaluation ||
            !hasCompleteAquiferCase ||
            patient_log_complete !== '2' ||
            (eor_repeat_score && eor_repeat_score < 380))
    ) {
        return 'bg_rotationstart'; // Red
    }


    return ''; // Default to no color coding
};

// Function to extract specialty abbreviation from record_id
const getSpecialtyFromRecordId = (recordId) => {
    const parts = recordId.split('_');
    return parts.length > 2 ? parts[2]  : "";
};

function App() {
    const [periodDates, setPeriodDates] = useState({});
    const [studentsData, setStudentsData] = useState({});

    useEffect(() => {
        // Assuming these values are present and set by PHP on initial page load
        setPeriodDates(window.periodDates || {});
        setStudentsData(window.studentsData || {});
    }, []); // Empty dependency array ensures this effect only runs once on mount

    const queryParams = new URLSearchParams(window.location.search);
    const isAdminView = queryParams.get('view') === 'admin';

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
                                    {isAdminView && (
                                        <div className={"sutdent_links"}>
                                            {student.periods[0]?.student_url && (<a href={student.periods[0].student_url} target="_blank" rel="noopener noreferrer" title={"Clerkship Evaulations"}><GraphUp /> Clerkship Evaluations</a>)}
                                            <a href="#" target="_blank" rel="noopener noreferrer"><ListCheck /> General Onboarding</a>
                                            <a href="#" target="_blank" rel="noopener noreferrer"><FileEarmarkText /> Addl. Onboarding</a>
                                        </div>
                                    )}
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
                                </td>

                                {student.periods.map((period, index) => {
                                    const cssClass = getCssClassForRotation(period, isAdminView);
                                    return (
                                        <td key={index} className={cssClass}>
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
                                            {isAdminView && (
                                                <div>
                                                    <a href="#" target="_blank" rel="noopener noreferrer"><ListCheck /> Onboarding</a>
                                                    <a href="#" target="_blank" rel="noopener noreferrer"><ClipboardData /> CEF</a>
                                                    <a href="#" target="_blank" rel="noopener noreferrer"><ListCheck /> Patient Log</a>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    );

}

export default App;
