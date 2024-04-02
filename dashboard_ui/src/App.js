import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import { Link, FileEarmarkText, FileEarmarkPlus, PersonCheck, Calendar, Envelope, ClipboardHeart, JournalMedical, PersonRolodex, ClipboardData, ListCheck, GraphUp } from 'react-bootstrap-icons';

import './App.css';

const getCssClassForRotation = (rotationData, isAdminView) => {
    let result = {
        className: '',
        data: {}
    };

    const {
        site_confirmation_complete: site_confirmation_complete,
        student_evaluation_of_preceptor_complete: studentEvalComp,
        preceptor_evals = [],
        communication_forms_complete: commFormsComp,
        patient_log_complete: patientLogComp,
        fail_eor: failEor,
        eor_repeat_score: eorRepeatScore,
        start_date: startDateStr,
        average_score: avgScore,
        aquifer302,
        aquifer304,
        aquifer311,
        aquifer_other,
        specialty,
    } = rotationData;

    const today = new Date();
    const startDate = new Date(startDateStr);
    const rotationEnd = new Date(startDate);
    rotationEnd.setDate(rotationEnd.getDate() + 17);

    const preceptorEvalComp = preceptor_evals.some(evaluation => Object.values(evaluation).includes('2'));
    const aquiferCaseComp = ['1', 'SURG', 'ELV'].includes(specialty) || [aquifer302, aquifer304, aquifer311, aquifer_other].includes('1');

    let flags = {
        rotationEndPassed: rotationEnd < today,
        studentEvalComp: studentEvalComp === '2',
        preceptorEvalComp,
        aquiferCaseComp,
        patientLogComp: patientLogComp === '2',
        avgScoreHigh: avgScore > 3,
        commFormsComp: commFormsComp === '2',
        noFailEor: failEor === '0',
        eorRepeatScoreLow: eorRepeatScore && eorRepeatScore < 380,
        siteConfirmed: site_confirmation_complete === '2',
        startDatePassed: startDate < today,
        startDateOrEqual: startDate <= today
    };

    if (flags.rotationEndPassed && flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp &&
        flags.patientLogComp && flags.avgScoreHigh && flags.commFormsComp && flags.noFailEor) {
        result.className = 'bg_rotationend'; // Green
    } else if (flags.startDatePassed && ((flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp &&
        flags.patientLogComp && (!flags.avgScoreHigh || !flags.commFormsComp)) || failEor === '1')) {
        result.className = 'bg_rotationongoing'; // Yellow
    } else if (flags.startDateOrEqual && (!flags.studentEvalComp || !flags.preceptorEvalComp || !flags.aquiferCaseComp ||
        !flags.patientLogComp || flags.eorRepeatScoreLow)) {
        result.className = 'bg_rotationstart'; // Red, using `startDateOrEqual` for this condition
    } else if (flags.siteConfirmed && flags.startDatePassed) {
        result.className = 'bg_complete'; // Grey
    }

    if (!isAdminView) {
        result.className = '';
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
                                                                    <a href="#!" onClick={(e) => {
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
