import React, { useState, useEffect } from 'react';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';
import { Link, FileEarmarkText, FileEarmarkPlus, PersonCheck, Envelope, ClipboardHeart, JournalMedical, PersonRolodex, GraphUp } from 'react-bootstrap-icons';
import './App.css';

// Function to determine the CSS class based on rotation data and criteria
const getCssClassForRotation = (rotationData, isAdminView) => {
    let result = { className: '', criteria: [], data: {} };

    const {
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

    const hasCompletePreceptorEvaluation = preceptor_evals.some(evaluation =>
        ['internal_medicine_i_complete', 'internal_medicine_ii_complete', 'primary_care_i_complete', 'primary_care_ii_complete', 'pediatrics_complete', 'surgery_complete', 'emergency_medicine_complete', 'womens_health_complete', 'behavioral_medicine_complete', 'electives_complete']
            .some(key => evaluation[key] === '2')
    );

    const hasCompleteAquiferCase = ['aquifer302', 'aquifer304', 'aquifer311', 'aquifer_other'].some(key => rotationData[key] === '1') || ['SURG', 'ELV'].includes(specialty);

    const flags = {
        rotationEndPassed: rotationEnd < today,
        studentEvalComp: student_evaluation_of_preceptor_complete === '2',
        preceptorEvalComp: hasCompletePreceptorEvaluation,
        aquiferCaseComp: hasCompleteAquiferCase,
        patientLogComp: patient_log_complete === '2',
        avgScoreHigh: average_score > 3,
        commFormsComp: communication_forms_complete === '2',
        noFailEor: fail_eor === '0',
        eorRepeatScoreLow: eor_repeat_score && eor_repeat_score < 380,
        startDatePassed: startDate < today,
        startDateOrEqual: startDate <= today,
    };

    // Determine class name and criteria based on flags
    if (flags.rotationEndPassed && flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp && flags.patientLogComp && flags.avgScoreHigh && flags.commFormsComp && flags.noFailEor) {
        result.className = 'bg_rotationend';
        result.criteria.push('Rotation Ended', 'SEP Complete', 'PES Complete', 'Aquifer Complete', 'Patient Log', 'PES Satisfactory', 'Feedback Sent', 'EOR Passed');
    } else if (flags.startDatePassed && ((flags.studentEvalComp && flags.preceptorEvalComp && flags.aquiferCaseComp && flags.patientLogComp && !flags.commFormsComp) || flags.noFailEor)) {
        result.className = 'bg_rotationongoing';
        result.criteria.push('Rotation Started', 'SEP Complete', 'PES Complete', 'Aquifer Complete', 'Patient Log', 'PES Satisfactory', 'Feedback Sent', 'EOR Passed');
    } else if (flags.startDateOrEqual && (!flags.studentEvalComp || !flags.preceptorEvalComp || !flags.aquiferCaseComp || !flags.patientLogComp || flags.eorRepeatScoreLow)) {
        result.className = 'bg_rotationstart';
        result.criteria.push('Rotation Started', 'SEP Complete', 'PES Complete', 'Aquifer Complete', 'Patient Log', 'EOR Retake');
    } else if (flags.startDatePassed) {
        result.className = 'bg_complete';
        result.criteria.push('Rotation Started');
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
    return parts.length > 2 ? parts[2] : "";
};

function App() {
    const [periodDates, setPeriodDates] = useState({});
    const [studentsData, setStudentsData] = useState({});
    const [criteriaVisibility, setCriteriaVisibility] = useState({});

    const toggleCriteriaVisibility = (index) => {
        setCriteriaVisibility(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    useEffect(() => {
        setPeriodDates(window.periodDates || {});
        setStudentsData(window.studentsData || {});

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

    let students = Object.keys(studentsData).map(studentKey => {
        const lastName = studentKey.split('_')[1].split(',')[0].trim();

        const studentPeriods = Object.keys(periodDates).map(periodKey => {
            const month = periodKey.split(' ')[1];
            const periodData = studentsData[studentKey].find(p => p.month === month) || {};
            return {
                ...periodData,
                specialty: periodData.record_id ? getSpecialtyFromRecordId(periodData.record_id) : '',
                locationParts: periodData.location ? periodData.location.split("_") : [],
                siteAddress: periodData.site_address || ''
            };
        });

        return {
            key: studentKey,
            name: studentsData[studentKey]?.[0]?.full_name || "Unknown",
            lastName,
            periods: studentPeriods
        };
    });

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
                        const scheduleLink = student.periods[0]?.student_schedule;
                        const mailtoLink = `mailto:${student.periods[0]?.email}?subject=Your 2024 - 2025 Rotation Schedule&body=See your schedule at: ${encodeURIComponent(scheduleLink)}`;

                        return (
                            <tr key={studentIndex}>
                                <td>
                                    <div>{student.name}</div>
                                    {(student.periods[0]?.student_url || student.periods[0]?.le_student_url) && (
                                        <div className={"student_links"}>
                                            <p>Evaluation Links</p>
                                            {student.periods[0]?.student_url && (
                                                <a href={student.periods[0].student_url} target="_blank" rel="noopener noreferrer" title={"Clerkship Evaluations"}><PersonCheck /></a>
                                            )}
                                            {student.periods[0]?.le_student_url && (
                                                <a href={student.periods[0].le_student_url} target="_blank" rel="noopener noreferrer" title={"Individual Lecture Evaluations"}><GraphUp /></a>
                                            )}
                                        </div>
                                    )}
                                    {(student.periods[0]?.gen_onboarding_link || student.periods[0]?.addl_onboarding_link) && (
                                        <div className={"student_links"}>
                                            <p>Onboarding Links</p>
                                            {student.periods[0]?.gen_onboarding_link && (
                                                <a href={student.periods[0].gen_onboarding_link} target="_blank" rel="noopener noreferrer" title={"General Onboarding Docs"}><FileEarmarkText /></a>
                                            )}
                                            {student.periods[0]?.addl_onboarding_link && (
                                                <a href={student.periods[0].addl_onboarding_link} target="_blank" rel="noopener noreferrer" title={"Additional Onboarding Docs"}><FileEarmarkPlus /></a>
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
                                    const hasRotationData = period.location || period.specialty;
                                    const showCriteria = criteriaVisibility[`${studentIndex}_${index}`];

                                    return (
                                        <td key={index} className={cssInfo.className}>
                                            <Tooltip title={period.siteAddress} position="top" key={index}>
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
                                                        <a href={period.onboarding_link} target="_blank" rel="noopener noreferrer" title={"Rotation Onboarding"}><PersonRolodex /></a>
                                                    )}
                                                    {period.cef_url && (
                                                        <a href={period.cef_url} target="_blank" rel="noopener noreferrer" title={"Clerkship Expectations Form"}><JournalMedical /></a>
                                                    )}
                                                    {period.patient_log_url && (
                                                        <a href={period.patient_log_url} target="_blank" rel="noopener noreferrer" title={"Patient Logs"}><ClipboardHeart /></a>
                                                    )}
                                                </div>
                                            )}
                                            {(isAdminView && hasRotationData && cssInfo.data) && (
                                                <div className={`student_links`}>
                                                    <p onClick={() => toggleCriteriaVisibility(`${studentIndex}_${index}`)} className={`status-criteria-toggle ${criteriaVisibility[`${studentIndex}_${index}`] ? 'expanded' : ''}`}>
                                                        Status Criteria
                                                    </p>

                                                    {showCriteria && (
                                                        <ul className="status_criteria">
                                                            {Object.entries(cssInfo.data).map(([key, value]) => (
                                                                <li key={key}>
                                                                    <a href="#!" className={cssInfo.criteria.includes(key) ? 'highlight_critera' : ''} style={{ color: value ? 'green' : 'red' }}>
                                                                        {`${key}: ${value}`}
                                                                    </a>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;
