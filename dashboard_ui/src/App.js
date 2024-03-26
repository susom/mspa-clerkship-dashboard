import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import { Link, FileEarmarkText, FileEarmarkPlus, Calendar, Envelope, ClipboardHeart, JournalMedical, PersonRolodex, ClipboardData, ListCheck, GraphUp } from 'react-bootstrap-icons';

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
        average_score,

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

    // console.log('bg_rotationend:' + rotationData.start_date, rotationEnd < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, average_score, communication_forms_complete, hasCompleteAquiferCase, patient_log_complete, fail_eor);
    if (rotationEnd < today &&
        student_evaluation_of_preceptor_complete === '2' &&
        hasCompletePreceptorEvaluation &&
        average_score > 3 &&
        communication_forms_complete === '2' &&
        hasCompleteAquiferCase &&
        patient_log_complete === '2' &&
        fail_eor === '0'
    ) {
        return 'bg_rotationend'; // Green
    }

    console.log('bg_rotationongoing:' + rotationData.start_date, startDate < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, hasCompleteAquiferCase, patient_log_complete, average_score, communication_forms_complete, fail_eor);
    if (startDate < today &&
        ( student_evaluation_of_preceptor_complete === '2' &&
        hasCompletePreceptorEvaluation &&
        hasCompleteAquiferCase &&
        patient_log_complete === '2' &&
        (average_score < 3 || communication_forms_complete !== '2') )
        || (fail_eor === '1')
    ) {
        return 'bg_rotationongoing'; // Yellow
    }

    console.log('bg_rotationstart:' + rotationData.start_date, startDate < today,  student_evaluation_of_preceptor_complete, hasCompletePreceptorEvaluation, hasCompleteAquiferCase, patient_log_complete, eor_repeat_score, eor_repeat_score);
    if (startDate < today &&
        ( student_evaluation_of_preceptor_complete !== '2' ||
        !hasCompletePreceptorEvaluation ||
        !hasCompleteAquiferCase ||
        patient_log_complete !== '2' ||
        (eor_repeat_score && eor_repeat_score < 380) )
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
                                        <div className={"student_links"}>
                                            <p>Student Links</p>
                                            {student.periods[0]?.student_url && (
                                                <a href={student.periods[0].student_url} target="_blank"
                                                   rel="noopener noreferrer" title={"Clerkship Evaulations"}><GraphUp/></a>)}
                                            {student.periods[0]?.gen_onboarding_link && (
                                                <a href={student.periods[0].gen_onboarding_link} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"General Onboarding Docs"}><FileEarmarkText/></a>)}
                                            {student.periods[0]?.addl_onboarding_link && (
                                                <a href={student.periods[0].addl_onboarding_link} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"Additional Onboarding Docs"}><FileEarmarkPlus/></a>)}
                                        </div>
                                    )}
                                    {student.periods[0]?.student_schedule && (
                                        <div className={`student_links`}>
                                            <p>Student Schedule</p>
                                            <a href={mailtoLink} target="_blank" rel="noopener noreferrer"><Envelope /></a>
                                            <span>|</span>
                                            <a href={scheduleLink} target="_blank" rel="noopener noreferrer"><Link /></a>
                                        </div>
                                    )}
                                </td>

                                {student.periods.map((period, index) => {
                                    const cssClass = getCssClassForRotation(period, isAdminView);
                                    const hasRotationData = period.location || period.specialty; // Add more checks as needed
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
                                            {isAdminView && hasRotationData && (
                                                <div className={`student_links`}>
                                                    <p>Rotation Links</p>
                                                    {period.onboarding_link && (
                                                        <a href={period.onboarding_link} target="_blank"
                                                           rel="noopener noreferrer"
                                                           title={"Rotation Onboarding"}><PersonRolodex/></a>
                                                    )}
                                                    {period.cef_url && (
                                                        <a href={period.cef_url} target="_blank"
                                                           rel="noopener noreferrer"
                                                           title={"Clerkship Expectations Form"}><JournalMedical/></a>
                                                    )}
                                                    {period.patient_log_url && (
                                                        <a href={period.patient_log_url} target="_blank"
                                                           rel="noopener noreferrer" title={"Patient Logs"}><ClipboardHeart/></a>
                                                    )}
                                                </div>
                                            )}
                                            {period.average_score && (
                                                <span className="average-score">{period.average_score}</span>
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
