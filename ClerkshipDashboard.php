<?php
namespace Stanford\ClerkshipDashboard;

require_once "emLoggerTrait.php";

use REDCap;
use DateTime;

class ClerkshipDashboard extends \ExternalModules\AbstractExternalModule {

    use emLoggerTrait;

    const BUILD_FILE_DIR = 'dashboard_ui/build/static/';

    public function __construct() {
		parent::__construct();
		// Other code to run when object is instantiated
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
    public function getRotationsForYear($student_id = null, $year = 2025) {
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

        return $students;
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

        // Return the dates in the order of the period sequence
        return array_values($startDates);
    }


    public function generatePeriodDates($dates, $endDateOffset = 23) {
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

        $this->emLog($periodDates);

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
