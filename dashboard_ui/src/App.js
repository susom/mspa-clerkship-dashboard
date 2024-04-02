import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import { Link, FileEarmarkText, FileEarmarkPlus, PersonCheck, Calendar, Envelope, ClipboardHeart, JournalMedical, PersonRolodex, ClipboardData, ListCheck, GraphUp } from 'react-bootstrap-icons';

import './App.css';

const getCssClassForRotation = (rotationData, isAdminView) => {
    let result = {
        className: '',
        criteria: [],
        data: {}
    };

    const {
        site_confirmation_complete,
        student_evaluation_of_preceptor_complete,
        preceptor_evals = [],
        communication_forms_complete,
        patient_log_complete,
        fail_eor,
        eor_repeat_score,
        start_date,
        average_score,
        aquifer302 = '',
        aquifer304 = '',
        aquifer311 = '',
        aquifer_other = '',
        specialty,
    } = rotationData;

    const today = new Date();
    const startDate = new Date(start_date);
    const rotationEnd = new Date(startDate);
    rotationEnd.setDate(rotationEnd.getDate() + 17); // Add 17 days to start date

    // Keep the preceptor evaluations check as is
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

    // Check for Aquifer case completion
    const hasCompleteAquiferCase = aquifer302 === '1' ||
        aquifer304 === '1' ||
        aquifer311 === '1' ||
        aquifer_other === '1' ||
        specialty === 'SURG' ||
        specialty === 'ELV'; // These specialties don't require Aquifer cases

    // Flag definitions
    let flags = {
        rotationEndPassed: rotationEnd < today,
        studentEvalComp: student_evaluation_of_preceptor_complete === '2',
        preceptorEvalComp: hasCompletePreceptorEvaluation,
        aquiferCaseComp: hasCompleteAquiferCase,
        patientLogComp: patient_log_complete === '2',
        avgScoreHigh: average_score > 3,
        commFormsComp: communication_forms_complete === '2',
        noFailEor: fail_eor === '0',
        eorRepeatScoreLow: eor_repeat_score && eor_repeat_score < 380,
        siteConfirmed: site_confirmation_complete === '2',
        startDatePassed: startDate < today,
        startDateOrEqual: startDate <= today,
    };

    if (flags.rotationEndPassed && flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp &&
        flags.patientLogComp && flags.avgScoreHigh && flags.commFormsComp && flags.noFailEor) {
        result.className = 'bg_rotationend';
        result.criteria.push('rotationEndPassed', 'studentEvalComp', 'preceptorEvalComp', 'aquiferCaseComp', 'patientLogComp', 'avgScoreHigh', 'commFormsComp', 'noFailEor');
    } else if (flags.startDatePassed && ((flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp &&
        flags.patientLogComp && (!flags.avgScoreHigh || !flags.commFormsComp)) || flags.noFailEor)) {
        result.className = 'bg_rotationongoing';
        result.criteria.push('startDatePassed', 'studentEvalComp', 'preceptorEvalComp', 'aquiferCaseComp', 'patientLogComp', 'avgScoreHigh', 'commFormsComp', 'noFailEor');
    } else if (flags.startDateOrEqual && (!flags.studentEvalComp || !flags.preceptorEvalComp || !flags.aquiferCaseComp ||
        !flags.patientLogComp || flags.eorRepeatScoreLow)) {
        result.className = 'bg_rotationstart';
        result.criteria.push('startDateOrEqual', 'studentEvalComp', 'preceptorEvalComp', 'aquiferCaseComp', 'patientLogComp', 'eorRepeatScoreLow');
    } else if (flags.siteConfirmed && flags.startDatePassed) {
        result.className = 'bg_complete';
        result.criteria.push('siteConfirmed', 'startDatePassed');
    }

    if (!isAdminView) {
        result.className = '';
        result.criteria = [];
    }

    result.data = flags; // Consolidated condition checks for easy reference

    return result;
};


// Function to extract specialty abbreviation from record_id
const getSpecialtyFromRecordId = (recordId) => {
    const parts = recordId.split('_');
    return parts.length > 2 ? parts[2]  : "";
};

function App() {
    const [periodDates, setPeriodDates] = useState({});
    const [studentsData, setStudentsData] = useState({});
    const [criteriaVisibility, setCriteriaVisibility] = useState({}); // State object to control the visibility of each criteria list

    const toggleCriteriaVisibility = (index) => {
        setCriteriaVisibility(prev => ({
            ...prev,
            [index]: !prev[index] // Toggle the boolean value for the index
        }));
    };

    useEffect(() => {
        setPeriodDates(window.periodDates || {});
        setStudentsData(window.studentsData || {});

        // Initialize criteria visibility state
        const initialVisibility = {};
        Object.keys(window.studentsData || {}).forEach((studentKey, studentIndex) => {
            window.studentsData[studentKey].forEach((_, periodIndex) => {
                initialVisibility[`${studentIndex}_${periodIndex}`] = false;
            });
        });
        setCriteriaVisibility(initialVisibility);
    }, []);


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
                        console.log("student data", student.periods[0]);

                        return(<tr key={studentIndex}>
                                <td>
                                    <div>{student.name}</div>
                                    {(student.periods[0]?.student_url || student.periods[0]?.le_student_url) && (
                                        <div className={"student_links"}>
                                            <p>Evaluation Links</p>
                                            {student.periods[0]?.student_url && (
                                                <a href={student.periods[0].student_url} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"Clerkship Evaulations"}><PersonCheck/></a>
                                            )}
                                            {student.periods[0]?.le_student_url && (
                                                <a href={student.periods[0].le_student_url} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"Individual Lecture Evaluations"}><GraphUp/></a>
                                            )}
                                        </div>
                                    )}
                                    {(student.periods[0]?.gen_onboarding_link || student.periods[0]?.addl_onboarding_link) && (
                                        <div className={"student_links"}>
                                            <p>Onboarding Links</p>
                                            {student.periods[0]?.gen_onboarding_link && (
                                                <a href={student.periods[0].gen_onboarding_link} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"General Onboarding Docs"}><FileEarmarkText/></a>
                                            )}
                                            {student.periods[0]?.addl_onboarding_link && (
                                                <a href={student.periods[0].addl_onboarding_link} target="_blank"
                                                   rel="noopener noreferrer"
                                                   title={"Additional Onboarding Docs"}><FileEarmarkPlus/></a>
                                            )}
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
                                    const cssInfo = getCssClassForRotation(period, isAdminView);
                                    const hasRotationData = period.location || period.specialty; // Add more checks as needed
                                    const showCriteria = criteriaVisibility[`${studentIndex}_${index}`]; // This should be the state that controls visibility

                                    return (
                                        <td key={index} className={cssInfo.className}>
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
                                            {hasRotationData && (
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
                                            {(isAdminView && hasRotationData && cssInfo.data ) && (
                                                <div className={`student_links`}>
                                                    <p
                                                        onClick={() => toggleCriteriaVisibility(`${studentIndex}_${index}`)}
                                                        className={`status-criteria-toggle ${criteriaVisibility[`${studentIndex}_${index}`] ? 'expanded' : ''}`}
                                                    >
                                                        Status Criteria
                                                    </p>

                                                    {showCriteria && (
                                                        <ul className="status_criteria">
                                                            {Object.entries(cssInfo.data).map(([key, value]) => (
                                                                <li key={key}>
                                                                    <a href="#!" className={cssInfo.criteria.includes(key) ? 'highlight_critera' : ''} onClick={(e) => {
                                                                        e.preventDefault();
                                                                        // Define your link click handler here
                                                                    }}>
                                                                        {`${key}: ${value}`}
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
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
