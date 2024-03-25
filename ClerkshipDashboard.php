<?php
namespace Stanford\ClerkshipDashboard;

require_once "emLoggerTrait.php";

use REDCap;
use DateTime;

class ClerkshipDashboard extends \ExternalModules\AbstractExternalModule {

    use emLoggerTrait;

    const BUILD_FILE_DIR = 'dashboard_ui/build/static/';
    private $default_year;
    private $default_rotation_offset;
    private $project_id_mspa;
    private $project_id_patient_log;
    private $project_id_onboarding;

    public function __construct() {
		parent::__construct();
		// Other code to run when object is instantiated

        $this->default_year             = $this->getProjectSetting("project-default-rotation-year");
        $this->default_rotation_offset  = $this->getProjectSetting("project-default-rotation-offset");
        $this->project_id_mspa          = $this->getProjectSetting("project-id-mspa");
        $this->project_id_patient_log   = $this->getProjectSetting("project-id-patient-log");
        $this->project_id_onboarding    = $this->getProjectSetting("project-id-onboarding");
    }

    /**
     * @return array
     * Gets fieldnames for "Rotation" Instrument
     */
    public function getClinicalSiteAddresses() {
        // Define the parameters for the REDCap::getData function
        $params = array(
            'return_format' => 'array',
            'fields' => array("record_id", "site_address"),
            'events' => array("site_review_arm_5")
        );

        // Retrieve data from REDCap
        $data = REDCap::getData($params);
        $sites = array();
        foreach ($data as $recordId => $nestedData) {
            // Check if repeat instances exist
            if (isset($nestedData['repeat_instances'])) {
                foreach ($nestedData['repeat_instances'] as $eventId => $instances) {
                    foreach ($instances['clinical_site_evaluation'] as $instance) {
                        if (!empty($instance['site_address'])) {
                            // Store the first non-empty site address and stop further iteration
                            $sites[$recordId] = $instance['site_address'];
                            break 2; // Exit from both foreach loops
                        }
                    }
                }
            }
        }

        return $sites;
    }

    /**
     * @return array
     * Gets fieldnames for "Rotation" Instrument
     */
    public function getRotationInstrumentFields() {
        // Retrieve the data dictionary from REDCap
        $dataDictionary = REDCap::getDataDictionary("array", false, null, array("rotation"));

        // Loop through the data dictionary and add field names to the array
        foreach ($dataDictionary as $field_name => $field_attributes) {
            // Add the field name to the fields array
            $fields[] = $field_name;
        }

        $fields = array_merge($fields, array("record_id", "patient_log_complete",  "site_confirmation_complete" ) );
        return $fields;
    }

    /**
     * @return json
     * get Data student Details
     */
    public function getStudentDetails($year = null) {
        // Define the parameters for the REDCap::getData function
        $params = array(
            'return_format' => 'array',
            'fields' => array("email", "student_url", "first_name", "last_name"),
            'events' => array("student_arm_1")
        );

        // Retrieve data from REDCap
        $data       = REDCap::getData($params);
        $students   = array();
        foreach($data as $student_key => $nested){
            $studentDetails = current($nested);

            // Check if $studentDetails is an array and has the required fields
            if (is_array($studentDetails) && isset($studentDetails['first_name'], $studentDetails['last_name'])) {
                if(!is_null($year) && strpos($student_key, $year) !== 0){
                    continue;
                }
                $students[$student_key] = $studentDetails;
            }
        }

        return $students;
    }

    /**
     * @return json
     * get Data for this years Student and their Rotations and return json
     */
    public function getRotationsForYear($student_id = null, $year = null) {
        if ($year === null) {
            $year = $this->default_year;
        }

        // First, get the clinical site addresses
        $siteAddresses      = $this->getClinicalSiteAddresses();
        $rotation_fields    = $this->getRotationInstrumentFields();
        $studentDetails     = $this->getStudentDetails($year);

        // Define the parameters for the REDCap::getData function
        $params = array(
            'return_format' => 'array', // Specifies the format of the returned data
            'fields' => $rotation_fields, // Retrieve all fields from the "Rotation" instrument
            'events' => array("rotation_arm_3")
        );

        //if only want to show one student
        if(!is_null($student_id)){
            $params["filterLogic"] = "[student_id] = '$student_id'";
        }

        // Retrieve data from REDCap
        $data       = REDCap::getData($params);
        $students   = array();
        foreach ($data as $recordId => $nestedData) {
            if (is_array($nestedData) && count($nestedData) > 0) {
                foreach ($nestedData as $event) {
                    // Check if the student_id starts with the specified year
                    if (strpos($event['student_id'], $year) === 0) {
                        $studentId      = $event['student_id'];
                        $month          = $event['month'];

                        // Flag to check if the period already exists
                        $periodExists   = false;

                        // Check if this period already exists for the student and combine locations if it does
                        if (isset($students[$studentId])) {
                            foreach ($students[$studentId] as $key => $existingEvent) {
                                if ($existingEvent['month'] == $month) {
                                    $periodExists       = true;
                                    $existingLocation   = $existingEvent['location'];
                                    $newLocation        = $event['location'];
                                    $students[$studentId][$key]['location'] = $existingLocation . "; " . $newLocation;
                                    break;
                                }
                            }
                        }

                        // Add new period data if it doesn't exist
                        if (!$periodExists) {
                            $event['record_id'] = $recordId;

                            // Format the full name
                            $nameParts = explode(',', str_replace($year . '_', '', $event['student_id']));
                            if (count($nameParts) == 2) {
                                $formattedName = trim($nameParts[1]) . ' ' . trim($nameParts[0]);
                                $event['full_name'] = $formattedName;
                            }

                            $location = $event['location'];
                            if (isset($siteAddresses[$location])) {
                                $event['site_address']  = $siteAddresses[$location];
                            } else {
                                $event['site_address']  = 'No Address Found';
                            }

                            if (isset($studentDetails[$studentId])) {
                                $event['email']         = $studentDetails[$studentId]['email'];
                                $event['student_url']   = $studentDetails[$studentId]['student_url'];
                            }

                            if(empty($_GET["student_id"])){
                                $student_view_url   = $this->getUrl('pages/root.php', true, true);
                                $student_view_url   = $student_view_url . "&student_id=" . $studentId;
                                $event["student_schedule"] = $student_view_url;
                            }

                            $students[$studentId][] = $event;
                        }
                    }
                }
            }
        }

        //TODO , STUB DATA, REPLACE WITH REAL getDATA fetches
        $students = $this->getStatusData($students, $year);
//        $this->emLog("getRotationsForYear example", $students);

        return $students;
    }

    public function getStatusData($studentData, $year){
        //THIS WILL AUGMENT THE STUDENTS DATA FOR ADMIN "view"
        if ($_GET['view'] === 'admin') {
            //NOW LETS GET ALL THE MSPA GRADES (aquifier vars) and add them to the student rotations
            $studentData = $this->getMSPAProjectData($studentData);

            //NOW LETS GET ALL THE CLERKSHIP EVAL .. PER ROTATION?
            $studentData = $this->getClerkShipEvalData($studentData, $year);

            //NOW CREATE THE LINKS TO ADD TO ROTATIONS
            $onboardingProjectFields = array(
                "contact_info",
                "general_onboarding",
                "additional_documentation"
            );
        }

        return $studentData;
    }

    public function getMSPAProjectData($studentData){
        $student_rotation_ids  =  array_keys($studentData);
//        $this->emDebug("student_rotation_ids", $student_rotation_ids, current($studentData));

        //LETS GET ALL THE RECORD IDS FOR OUR STUDENTS IN THE MSPA PROJECT
        $filters = [];
        foreach($student_rotation_ids as $student_rotation_id) {
            list($junk, $student_name) = explode("_", $student_rotation_id);
            list($ln, $fn) = explode(", ", trim($student_name));
            $filters[]  = "([last_name] = '".trim($ln)."' AND [first_name] = '".trim($fn)."')";
        }
        $filterLogic    = implode(' OR ', $filters);
        $params         = array(
            'project_id' => $this->project_id_mspa,
            'return_format' => 'array',
            'fields' => array("record_id", "last_name", "first_name"),
            'filterLogic' => $filterLogic
        );
        $data = REDCap::getData($params);
        $mspa_record_ids = array_keys($data);
//        $this->emDebug("mspa project record_id by students", $mspa_record_ids);

        //NOW LETS GET THE ACTUAL MSPA PROJECT VARIABLES
        $mspaAcademicProgressFields = array(
            "record_id",
            "first_name",
            "last_name",
            "rotation",
            "rotation_period",
            "aquifer302",
            "aquifer304",
            "aquifer311",
            "aquifer_other",
            "fail_eor",
            "eor_repeat_score"
        );

        $params = array(
            'project_id' => $this->project_id_mspa,
            'return_format' => 'array', // Specifies the format of the returned data
            'fields' => $mspaAcademicProgressFields, // Retrieve all fields from the "Rotation" instrument
            'records' => $mspa_record_ids
        );
        $mspa_data = REDCap::getData($params);
//        $this->emDebug("mspa_data", $mspa_data);


        //FOR PLACE HOLDER IF NO DATA
        $mspa_na_array = [
            "aquifer302" => null,
            "aquifer304" => null,
            "aquifer311" => null,
            "aquifer_other" => null,
            "fail_eor" => null,
            "eor_repeat_score" => null
        ];
        $mspa_keys_to_keep = ["aquifer302", "aquifer304", "aquifer311", "aquifer_other", "fail_eor", "eor_repeat_score"];

        //NOW LOOP THROUGH THE STUDENT DATA AN ALL THE ROTATION INFO AND ADD ON ALL THE MSPA GRADES DATA
        foreach($studentData as $student_rotation_id => &$rotations){
            //NOW WE LOOP THROUGH ALL THE MSPA DATA AND FIND THE STUDENT AND MATCH THEIR GRADES TO THEIR ROTATION AND ADD THE RIGHT VARIABLES
            foreach($mspa_data as $record_id => $student_grades){
                // THIS SHOULD BE THE FIRST ARRAY IN THE RETURN
                $student_mspa_info = current($student_grades);

                //LOOPING THROUGH ARRAY, FIND MATCHING STUDENT
                if( isset($student_mspa_info["last_name"]) ) {
                    $ln = $student_mspa_info["last_name"];
                    $fn = $student_mspa_info["first_name"];

                    if(strpos($student_rotation_id, "$ln, $fn") < 0){
                        continue;
                    }
                }

                //MADE IT THROUGH TO FIND A MATCH
                //OK THIS IS WEIRD, NESTED 2x... anyway to predict the keys?
                $grades_data = ( isset($student_grades["repeat_instances"]) ) ? current(current($student_grades["repeat_instances"])) : null;

                foreach($rotations as $idxkey => &$rotation){
                    $mspa_stuff = $mspa_na_array;
                    if($grades_data){
                        $rotation_period = $rotation["month"];
                        foreach($grades_data as $grade_data){
                            if($rotation_period == $grade_data["rotation_period"]){
                                unset($grade_data["last_name"]);
                                unset($grade_data["first_name"]);
                                unset($grade_data["rotation"]);
//                                unset($grade_data["rotation_period"]);
                                $mspa_stuff = $grade_data;
                                break;
                            }
                        }
                    }
                    $rotation = array_merge($rotation, $mspa_stuff);
                }
                unset($rotation);
            }
        }
        unset($rotations);

//        $this->emDebug("student_data with grades", current($studentData));
        return $studentData;
    }

    public function getClerkShipEvalData($studentData, $year) {
        $startDates = $this->extractStartDatesForPeriods($studentData);

        // Define the fields from the clerkship evaluation to retrieve
        $clerkshipEvaluationsFields = array(
            "preceptor_id",
            "rotation_id",
            "pes_complete", // preceptor_student_arm_4
            "psr_start_date",

            "student_evaluation_of_preceptor_complete", // preceptor_student_arm_4
            "internal_medicine_i_complete", // preceptor_student_arm_4
            "internal_medicine_ii_complete", // preceptor_student_arm_4
            "primary_care_i_complete", // preceptor_student_arm_4
            "primary_care_ii_complete", // preceptor_student_arm_4
            "pediatrics_complete", // preceptor_student_arm_4
            "surgery_complete", // preceptor_student_arm_4
            "emergency_medicine_complete", // preceptor_student_arm_4
            "womens_health_complete", // preceptor_student_arm_4
            "behavioral_medicine_complete", // preceptor_student_arm_4
            "electives_complete", // preceptor_student_arm_4
            "communication_forms_complete" // preceptor_student_arm_4
        );

        $params = [
            'return_format' => 'array',
            'fields' => $clerkshipEvaluationsFields,
            'events' => ["preceptor_student_arm_4"], // Specify the event arm(s) if needed
        ];

        // Retrieve and store the data
        $allClerkshipEvalData = REDCap::getData($params);

        $just_this_year = [];
        foreach($allClerkshipEvalData as $record_id => $array_structure){
            if(strpos($record_id,$year) < 0){
                continue;
            }
            $this->flattenClerkshipData($array_structure, $just_this_year, $year);
        }
//        $this->emDebug("allClerkshipEvalData",  $allClerkshipEvalData);

        $studentData = $this->mergeClerkshipDataWithStudentData($studentData, $just_this_year);

//        $this->emDebug("studentData", current($studentData));
        // Optional: Process $allClerkshipEvalData as needed to augment $studentData
        // This step will depend on how you need to integrate or use the retrieved data with your existing student data

        // Return the potentially augmented student data
        return $studentData;
    }

    public function mergeClerkshipDataWithStudentData($studentData, $clerkshipEvalData) {
        foreach ($studentData as $studentKey => &$rotations) {
            foreach ($rotations as &$rotation) {
                // Define the initial set of potential matches based on `rotation_id` or `psr_start_date`
                $potentialMatches = [];

                // Format the start_date to match the psr_start_date format if necessary
                $formattedStartDate = date('Y-m-d', strtotime($rotation['start_date'])); // Adjust the format as needed

                // Loop through clerkshipEvalData to find potential matches
                foreach ($clerkshipEvalData as $eval) {
                    // Ensure psr_start_date matches the rotation's start_date
                    if ($formattedStartDate !== $eval['psr_start_date']) {
                        continue; // Skip this iteration if start dates don't match
                    }

                    // Check direct match for `rotation_id`
                    if ($rotation['record_id'] === $eval['rotation_id']) {
                        $potentialMatches[] = $eval;
                        continue;
                    }

                    // Attempt to match based on partial string match between `rotation_id` and `student_id`
                    if (strpos($eval['rotation_id'], substr($studentKey, 5)) !== false) {
                        $potentialMatches[] = $eval;
                    }
                }

                // Process potential matches
                if (!empty($potentialMatches)) {
                    // Store all matches under 'preceptor_evals'
                    $rotation['preceptor_evals'] = $potentialMatches;

                    // If there's at least one match, merge the properties of the first match
                    $rotation = array_merge($rotation, reset($potentialMatches));
                }
            }
            unset($rotation); // Important: unset the last reference to avoid unexpected results
        }
        unset($rotations); // Unset for the same reason as above

        return $studentData;
    }

    public function flattenClerkshipData($data, &$result, $year) {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                // If the key is numeric, it might be one of the nested arrays from REDCap
                if (is_numeric($key)) {
                    // Recursively process further nested data
                    $this->flattenClerkshipData($value, $result, $year);
                } elseif ($key === 'rotation_id' && strpos($value, $year) !== false) {
                    // We found a rotation_id with the correct year, so store the parent array
                    // because this is a valid rotation data entry
                    $result[] = $data;
                    return; // We return here because we've found our data point and processed it
                }
            }
        }
        return;
    }

    public function extractStartDatesForPeriods($studentData) {
        // Define the period sequence
        $periodSequence = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        // Initialize an array with "n/a" for each period
        $startDates = array_fill_keys($periodSequence, 'na');

        // Check if the first student's data is available
        if (!is_array($studentData) || empty($studentData)) {
            return array_values($startDates); // Return "n/a" for all periods if no data
        }

        // Get the first student's data
        $firstStudentData = reset($studentData);

        // Iterate over the student's data to extract start dates
        foreach ($firstStudentData as $data) {
            $month = (int)$data['month'];
            if (array_key_exists($month, $startDates)) {
                // Format the start date
                $startDateTime = DateTime::createFromFormat('Y-m-d', $data['start_date']);
                $startDateFormatted = $startDateTime ? $startDateTime->format('m-d-Y') : 'n/a';
                $startDates[$month] = $startDateFormatted;
            }
        }

        // $this->emLog("extractStartDatesForPeriods", $startDates);
        // Return the dates in the order of the period sequence
        return array_values($startDates);
    }

    public function generatePeriodDates($dates, $endDateOffset = null) {
        if ($endDateOffset === null) {
            $endDateOffset = $this->default_rotation_offset;
        }

        // Period sequence
        $periodSequence = ['Period 10', 'Period 11', 'Period 12', 'Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8', 'Period 9'];

        $periodDates = [];
        $previousYear = null;
        foreach ($periodSequence as $index => $period) {
            // Handle 'n/a' dates
            if (!isset($dates[$index]) || $dates[$index] === 'n/a') {
                $periodDates[$period] = ['start' => 'n/a', 'end' => 'n/a'];
                continue;
            }

            $startDate = $dates[$index];

            // Check if the date is valid
            $startDateTime = DateTime::createFromFormat('m-d-Y', $startDate);
            if ($startDateTime === false) {
                // Skip invalid dates
                $periodDates[$period] = ['start' => 'n/a', 'end' => 'n/a'];
                continue;
            }

            $year = $startDateTime->format('Y');

            // Format the start date
            $startFormatted = $startDateTime->format('n/j');
            if ($previousYear !== $year) {
                $startFormatted .= '/' . $startDateTime->format('y');
                $previousYear = $year;
            }

            // Calculate the end date
            $endDateTime = clone $startDateTime;
            $endDateTime->modify("+$endDateOffset days");
            $endFormatted = $endDateTime->format('n/j');

            // Add to the periodDates array
            $periodDates[$period] = [
                'start' => $startFormatted,
                'end' => $endFormatted
            ];
        }

        // $this->emLog("generatePeriodDates", $periodDates);
        return $periodDates;
    }

    /**
     * @return array
     * Scans dist directory for frontend build files for dynamic injection
     */
    public function generateAssetFiles(): array
    {
        $assetFolders = ['css', 'js', 'media']; // Add the subdirectories you want to scan
        $cwd = $this->getModulePath();
        $assets = [];

        foreach ($assetFolders as $folder) {
            $full_path = $cwd . self::BUILD_FILE_DIR . '/' . $folder;
            $dir_files = scandir($full_path);

            if (!$dir_files) {
                $this->emError("No directory files found in $full_path");
                continue;
            }

            foreach ($dir_files as $file) {
                if ($file === '.' || $file === '..') {
                    continue;
                }

                $url = $this->getUrl(self::BUILD_FILE_DIR . '/' . $folder . '/' . $file);

                $html = '';
                if (str_contains($file, '.js')) {
                    $html = "<script type='module' crossorigin src='{$url}'></script>";
                } elseif (str_contains($file, '.css')) {
                    $html = "<link rel='stylesheet' href='{$url}'>";
                }
                // Only add HTML if it's not empty (i.e., the file is a JS or CSS file)
                if ($html !== '') {
                    $assets[] = $html;
                }
            }
        }

        return $assets;
    }

    /**
     * Sanitizes user input in the action queue nested array
     * @param $payload
     * @return array|null
     */
    public function sanitizeInput($payload): array|string
    {
        $sanitizer = new Sanitizer();
        return $sanitizer->sanitize($payload);
    }

    /**
     * Helper method for inserting the JSMO JS into a page along with any preload data
     * @param $data
     * @param $init_method
     * @return void
     */
    public function injectJSMO($data = null, $init_method = null): void
    {
        echo $this->initializeJavascriptModuleObject();
        $cmds = [
            "module = " . $this->getJavascriptModuleObjectName(),
        ];
        if (!empty($data)) $cmds[] = "module.data = " . json_encode($data);
        if (!empty($init_method)) $cmds[] = "module.afterRender(module." . $init_method . ")";
        ?>
        <script src="<?= $this->getUrl("assets/jsmo.js", true) ?>"></script>
        <script>
            $(function () { <?php echo implode(";\n", $cmds) ?> })
        </script>
        <?php
    }

    /**
     * This is the primary ajax handler for JSMO calls
     * @param $action
     * @param $payload
     * @param $project_id
     * @param $record
     * @param $instrument
     * @param $event_id
     * @param $repeat_instance
     * @param $survey_hash
     * @param $response_id
     * @param $survey_queue_hash
     * @param $page
     * @param $page_full
     * @param $user_id
     * @param $group_id
     * @return array|array[]|bool
     * @throws Exception
     */
    public function redcap_module_ajax($action, $payload, $project_id, $record, $instrument, $event_id, $repeat_instance,
                                       $survey_hash, $response_id, $survey_queue_hash, $page, $page_full, $user_id, $group_id)
    {
        $sanitized = $this->sanitizeInput($payload);

        switch ($action) {
            case "TestAction":
                return "Test Action JSMO Ajax";

            case "getStudentData":
                $students = $this->getRotationsForYear();
                return $students;

            default:
                // Action not defined
                throw new Exception ("Action $action is not defined");
        }
    }
}
