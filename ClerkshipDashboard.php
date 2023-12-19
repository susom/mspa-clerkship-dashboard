<?php
namespace Stanford\ClerkshipDashboard;

require_once "emLoggerTrait.php";

use REDCap;

class ClerkshipDashboard extends \ExternalModules\AbstractExternalModule {

    use emLoggerTrait;

    const BUILD_FILE_DIR = 'dashboard_ui/build/static/';

    public function __construct() {
		parent::__construct();
		// Other code to run when object is instantiated
	}

    /**
     * @return json
     * get Data for this years Student and their Rotations and return json
     */
    public function getRotationsForYear($year = 2025) {
        // Define the parameters for the REDCap::getData function
        $params = array(
            'return_format' => 'array', // Specifies the format of the returned data
            'fields' => $this->getRotationInstrumentFields(), // Retrieve all fields from the "Rotation" instrument
            'events' => array("student_arm_1","rotation_arm_3")
        );

        // Retrieve data from REDCap
        $data       = REDCap::getData($params);
        $students   = array();
        foreach ($data as $recordId => $nestedData) {
            if (is_array($nestedData) && count($nestedData) > 0) {
                foreach ($nestedData as $event) {
                    // Check if the student_id starts with the specified year
                    if (strpos($event['student_id'], $year) === 0) {
                        $studentId = $event['student_id'];
                        $month = $event['month'];

                        // Flag to check if the period already exists
                        $periodExists = false;

                        // Check if this period already exists for the student and combine locations if it does
                        if (isset($students[$studentId])) {
                            foreach ($students[$studentId] as $key => $existingEvent) {
                                if ($existingEvent['month'] == $month) {
                                    $existingLocation = $existingEvent['location'];
                                    $newLocation = $event['location'];
                                    $students[$studentId][$key]['location'] = $existingLocation . "; " . $newLocation;
                                    $periodExists = true;
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

                            $students[$studentId][] = $event;
                        }
                    }
                }
            }
        }

        return json_encode($students);
    }

    /**
     * @return array
     * Gets fieldnames for "Rotation" Instrument
     */
    public function getRotationInstrumentFields() {
        // Retrieve the data dictionary from REDCap
        $dataDictionary = REDCap::getDataDictionary("array", false, null, "rotation");

        // Initialize an array to store the field names
        $fields = ["record_id", "full_name", "email"];

        // Loop through the data dictionary and add field names to the array
        foreach ($dataDictionary as $field_name => $field_attributes) {
            // Add the field name to the fields array
            $fields[] = $field_name;
        }

        return $fields;
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
                $students = array(

                        array(
                            'name' => 'Alibayli, Aykhan 1.5x',
                            'periods' => [
                                [
                                    'period' => 'Period 10',
                                    'location' => 'Palo Alto VA',
                                    'specialty' => 'Internal Medicine (IM1)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 11',
                                    'location' => 'Palo Alto VA',
                                    'specialty' => 'Behavioral Medicine',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 12',
                                    'location' => 'PAVA',
                                    'specialty' => 'Surgery',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 1',
                                    'location' => 'SHC',
                                    'specialty' => 'Emergency Medicine',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 2',
                                    'location' => 'SHC Santa Clara',
                                    'specialty' => 'Family Medicine (FM1)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 3',
                                    'location' => 'UHA Alameda Dr. Mirmira',
                                    'specialty' => 'Family Medicine (FM2)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 4',
                                    'location' => 'First Pediatrics Medical Group Dr. Maniam-Mohan',
                                    'specialty' => 'Peds',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 5',
                                    'location' => 'TriValley',
                                    'specialty' => 'Internal Medicine (IM2)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 6',
                                    'location' => 'Altos Oaks Med. Group (PCHA) Dr. Weber',
                                    'specialty' => "Women's Health",
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 7',
                                    'location' => 'SHC Med 7 Internal Medicine (IM1)',
                                    'specialty' => 'RETAKE',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 8',
                                    'location' => 'Palo Alto VA',
                                    'specialty' => 'Behavioral Medicine - elective (SW)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'Period 9',
                                    'location' => 'Palo Alto VA Behavioral Medicine - elective',
                                    'specialty' => '(SW)',
                                    'color' => '#FFFFFF',
                                ],
                                [
                                    'period' => 'TGR',
                                    'location' => '',
                                    'specialty' => '',
                                    'color' => '#FFFFFF',
                                ]
                            ]
                        )
                );

                return $students;

            default:
                // Action not defined
                throw new Exception ("Action $action is not defined");
        }
    }
}
