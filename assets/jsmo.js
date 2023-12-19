// This file extends the default JSMO object with methods for this EM
;{
    // Define the jsmo in IIFE so we can reference object in our new function methods
    const module_name   = "ClerkshipDashboard";
    const module        = ExternalModules.Stanford[module_name];

    // Extend the official JSMO with new methods
    Object.assign(module, {

        // Ajax function calling 'TestAction'
        InitFunction: function () {
            // Note use of jsmo to call methods
            module.ajax('TestAction', module.data).then(function (response) {
                // Process response
                console.log("Ajax Result: ", response);
            }).catch(function (err) {
                // Handle error
                console.log(err);
            });
        },

        // Get a list of all the actions from the log tables
        getStudentData: function () {
            console.log("getStudentData");

            module.ajax('getStudentData').then(function (response) {
                console.log("RESPONSE", response);
                return response;
            }).catch(function (err) {
                console.log("Error", err);
            })
        },
    });
}
