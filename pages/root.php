<?php
/** @var \Stanford\ClerkshipDashboard\ClerkshipDashboard $module */
$build_files    = $module->generateAssetFiles();

// Retrieve and sanitize student_id from GET request
$student_id     = filter_input(INPUT_GET, 'student_id', FILTER_SANITIZE_STRING);
$custom_year    = filter_input(INPUT_GET, 'year', FILTER_SANITIZE_STRING);

// Pass sanitized student_id to getRotationsForYear function
$studentsData   = $module->getRotationsForYear($student_id, $custom_year);
$startDates     = $module->extractStartDatesForPeriods($studentsData);
$periodDates    = $module->generatePeriodDates($startDates);
?>

<html lang="en">
<head>

    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Clerkship Dashboard</title>
    <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
    <script src="https://code.jquery.com/jquery-3.6.1.slim.min.js" integrity="sha256-w8CvhFs7iHNVUtnSP0YKEg00p9Ih13rlL9zGqvLdePA=" crossorigin="anonymous"></script>
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM"
        crossorigin="anonymous"
    />
    <link href="https://fonts.cdnfonts.com/css/source-sans-pro" rel="stylesheet">

    <script>
        //hmm how to better pass this in?
        window.studentsData = <?= json_encode($studentsData) ?>;
        window.periodDates  = <?= json_encode($periodDates) ?>
    </script>

    <?php
        $module->injectJSMO();
        foreach ($build_files as $file)
            echo $file;
    ?>
</head>
<body>
<div id="root"></div>
</body>
</html>

