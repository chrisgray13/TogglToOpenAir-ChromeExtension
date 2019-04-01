// This is to preserve the API key from use to use
(function setupApiKey() {
    let apiKeyInput = document.getElementById("apiKey");
    apiKeyInput.addEventListener("change", function () {
        chrome.storage.sync.set({
            apiKey: apiKey.value || ""
        });
    });

    chrome.storage.sync.get("apiKey", function (data) {
        let apiKeyValue = data.apiKey || "";
        if (apiKeyValue !== "") {
            apiKeyInput.value = apiKeyValue;
        }
    });
})();

(function setupStartDate() {
    let startDateInput = document.getElementById("startDate");
    if (startDateInput) {
        chrome.storage.local.get("startDate", function (data) {
            let startDateValue = data.startDate || "";
            if (startDateValue !== "") {
                startDateInput.value = startDateValue;
            }
        });
    }
})();

(function addCreateTimesheetHandler() {
    let createTimesheet = document.getElementById("createTimesheet");

    createTimesheet.addEventListener("click", function () {
        let msg = validateForm();
        if (msg) {
            setError(msg);
        } else {
            //sendActionToContentScript("loading");
            setVisibility("loading", true);

            let apiKeyInput = document.getElementById("apiKey");
            let apiKey = apiKeyInput.value;

            let workspaceResponse = getDefaultTogglWorkspace(apiKey, getTogglWorkspace);
            if (workspaceResponse === undefined) {
                setError("Unable to get workspace response");
            } else {
                workspaceResponse.then(function (workspaceId) {
                    if (workspaceId) {
                        let startDateCtrl = document.getElementById("startDate");

                        let timesheetDataResponse = getTimesheetData(apiKey, workspaceId, new Date(startDateCtrl.value));
                        if (timesheetDataResponse === undefined) {
                            setError("Unable to get timesheet data response");
                        } else {
                            timesheetDataResponse.then(function (timesheetData) {
                                let aggregatedTimesheetData = aggregateTimesheetData(timesheetData);
                                sendActionToContentScript("loadTimesheetData", aggregatedTimesheetData, function (response) {
                                    setVisibility("loading", false);
                                    if (response === undefined) {
                                        setError("Unable to determine the response for sendTimesheetData");
                                    } else if (response.success) {
                                        window.close();
                                    } else {
                                        setError(response.message);
                                    }
                                });
                            }, function (response, textStatus, errorThrown) {
                                setError("Unable to get timesheet data => ", response.status, textStatus, errorThrown, response.responseJSON.error.message, response.responseJSON.error.tip);
                            });
                        }
                    } else {
                        setError("Unable to determine Toggl workspace");
                    }
                }, function (response, textStatus, errorThrown) {
                    setError("Unable to get a default workspace => ", response.status, textStatus, errorThrown);
                });
            }
        }
    });
})();

function validateForm() {
    let msg = "";

    let apiKeyInput = document.getElementById("apiKey");
    if (!apiKeyInput || !apiKeyInput.value) {
        msg += "API key is required"
    }

    let startDateInput = document.getElementById("startDate");
    if (!startDateInput || !startDateInput.value) {
        if (msg) {
            msg += "\n";
        }

        msg += "Start date is required"
    }

    return msg;
}

function setVisibility(controlId, visibility) {
    let control = document.getElementById(controlId);
    if (control) {
        if (visibility) {
            control.setAttribute("class", "");
        } else {
            control.setAttribute("class", "hide");
        }
    } else {
        console.log("Unable to find the control to set visibility => ", controlId);
    }
}

function setError(msg) {
    setVisibility("loading", false);

    for (let i = 1; i < arguments.length; i++) {
        if (i === 1) {
            msg += " " + arguments[i].toString();
        } else {
            msg += ", " + arguments[i].toString();
        }
    }

    let toaster = document.getElementById("toaster");
    if (toaster) {
        if (toaster.getAttribute("class") === "hide") {
            toaster.firstElementChild.firstElementChild.innerText = msg;
            setVisibility("toaster", true);
            setTimeout(function () {
                setVisibility("toaster", false);
            }, Math.min(Math.max(msg.length * 150, 3000), 7000)); // Between 3000 and 7000
        } else {
            toaster.firstElementChild.firstElementChild.innerText += "\n" + msg;
        }
    } else {
        console.log("ERROR: Unable to find toaster.  Reverting to alert");
        alert(msg);
    }

    console.log("ERROR: " + msg);
}

function sendActionToContentScript(action, data, callback) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: action,
            data: data
        }, callback);
    });
}

function getDefaultTogglWorkspace(apiKey, workspaceFunction) {
    if (typeof (workspaceFunction) === "function") {
        return workspaceFunction(apiKey).then(function (workspaces, textStatus, response) {
            let workspaceId = undefined;

            if (workspaces.length == 1) {
                workspaceId = workspaces[0].id;
            } else if (workspaces.length == 0) {
                setError("Unable to find a Toggl workspace");
            } else {
                setError("More than one Toggl workspace exists");
            }

            return workspaceId;
        }, function (response, textStatus, errorThrown) {
            setError("Error getting workspaces => ", response.status, textStatus, errorThrown);
        });
    } else {
        setError("workspaceFunction is not a function.  Please pass a function to get a Toggl workspace.");

        return undefined;
    }
}

function getTogglWorkspace(apiKey) {
    return $.ajax({
        dataType: "json",
        headers: {
            "Authorization": "Basic " + btoa(apiKey + ":api_token")
        },
        method: "GET",
        url: "https://www.toggl.com/api/v8/workspaces",
    });
}

function getEndDate(startDate) {
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endDate;
}

function getTimesheetData(apiKey, workspaceId, startDate) {
    return getTogglReportDetails(apiKey, workspaceId,
        startDate.toISOString().substring(0, 10),
        getEndDate(startDate).toISOString().substring(0, 10),
        1, []);
}

function getTogglReportDetails(apiKey, workspaceId, startDate, endDate, page, reportDetails) {
    let detailsResponse =
        getTogglReportDetailsByPage(apiKey, workspaceId, startDate, endDate, page);

    return detailsResponse.then(function (response) {
        reportDetails = reportDetails.concat(response.data);
        if ((response.per_page * page) < response.total_count) {
            return getTogglReportDetails(apiKey, workspaceId, startDate, endDate, page + 1, reportDetails);
        } else {
            return reportDetails;
        }
    });
}

function getTogglReportDetailsByPage(apiKey, workspaceId, startDate, endDate, page) {
    return $.ajax({
        dataType: "json",
        headers: {
            "Authorization": "Basic " + btoa(apiKey + ":api_token")
        },
        method: "GET",
        url: "https://toggl.com/reports/api/v2/details?workspace_id=" + workspaceId +
            "&user_agent=toggle_to_openair&since=" + startDate + "&until=" + endDate +
            "&page=" + page + "&order_field=date&order_desc=off"
    });
}

function generateAggregateKey(entry) {
    return entry.client + "|" + entry.project;
}

function aggregateTimesheetData(timesheetData) {
    let aggregateData = {};

    for (let i = 0, dataLength = timesheetData.length; i < dataLength; i++) {
        let entry = timesheetData[i];
        entry.start = entry.start.substring(0, 10);
        entry.dur = entry.dur / 3600000.0; // 60 (mins) * 60 (secs) * 1000 (ms)

        let entryKey = generateAggregateKey(entry);
        if (entryKey in aggregateData) {
            let tempAggregate = aggregateData[entryKey];

            if (entry.start in tempAggregate) {
                let tempEntry = tempAggregate[entry.start];

                // Only add new descriptions
                if (tempEntry.description.indexOf(entry.description) == -1) { // Not found
                    tempEntry.description = tempEntry.description + ", " + entry.description;
                }

                tempEntry.dur = tempEntry.dur + entry.dur;

                tempAggregate[entry.start] = tempEntry;
            } else {
                tempAggregate[entry.start] = entry;
            }

            aggregateData[entryKey] = tempAggregate;
        } else {
            let startDate = entry.start;
            aggregateData[entryKey] = { [startDate]: entry };
        }
    }

    return aggregateData;
}