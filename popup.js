var cancellationToken;

function startPromiseTransaction() {
    cancellationToken = false;
}

function cancelPromiseTransaction() {
    cancellationToken = true;
}

function handlePromiseTransaction(work) {
    return function (response) {
        if (cancellationToken === false) {
            if (typeof (work) === "function") {
                return work(response);
            }
        }
    };
}

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

(function addImportProjectsHandler() {
    let importProjects = document.getElementById("importProjects");

    importProjects.addEventListener("click", function () {
        let msg = validateForm(true, false);
        if (msg) {
            setError(msg);
        } else {
            setVisibility("loading", true);
            startPromiseTransaction();

            let existingClients = [];
            let clientsToCopy = [];
            var credentials = {};

            sendActionToContentScript("getProjects", undefined).then(function (response) {
                if (response === undefined) {
                    setError("Unable to determine the response for getProjects");
                } else if (response.success) {
                    if (response.projects.length === 0) {
                        setError("No projects to import!");
                    } else {
                        clientsToCopy = response.projects;

                        return getTogglCredentials();
                    }
                } else {
                    setError(response.message);
                }

                cancelPromiseTransaction();
            }).then(handlePromiseTransaction(function (response) {
                credentials = response;

                return getTogglWorkspaceClients(credentials.apiKey, credentials.workspaceId);
            })).then(handlePromiseTransaction(function (clients) {
                existingClients = clients;
                return getTogglWorkspaceProjects(credentials.apiKey, credentials.workspaceId);
            }), function (response, textStatus, errorThrown) {
                setError("Unable to get clients => ", response.status, textStatus, errorThrown);
                cancelPromiseTransaction();
            }).then(handlePromiseTransaction(function (projects) {
                existingClients = mapToggleProjectsToClients(existingClients, projects);

                clientsToCopy = markNewClientsAndProjects(existingClients, clientsToCopy);

                return createClientsAndProjects(clientsToCopy, credentials.apiKey, credentials.workspaceId);
            }), function () {
                setError("Unable to get projects => ", response.status, textStatus, errorThrown);
                cancelPromiseTransaction();
            }).then(handlePromiseTransaction(function (data) {
                setVisibility("loading", false);
            }));
        }
    });
})();

(function addCreateTimesheetHandler() {
    let createTimesheet = document.getElementById("createTimesheet");

    createTimesheet.addEventListener("click", function () {
        let msg = validateForm();
        if (msg) {
            setError(msg);
        } else {
            setVisibility("loading", true);
            startPromiseTransaction();

            getTogglCredentials().then(function (credentials) {
                if (credentials) {
                    let startDateCtrl = document.getElementById("startDate");

                    return getTimesheetData(credentials.apiKey, credentials.workspaceId, new Date(startDateCtrl.value));
                } else {
                    cancelPromiseTransaction();
                }
            }).then(handlePromiseTransaction(function (timesheetData) {
                let aggregatedTimesheetData = aggregateTimesheetData(timesheetData);

                return sendActionToContentScript("loadTimesheetData", aggregatedTimesheetData);
            })).then(handlePromiseTransaction(function (response) {
                if (response === undefined) {
                    setError("Unable to determine the response for sendTimesheetData");
                } else if (response.success) {
                    setVisibility("loading", false);
                    window.close();
                } else {
                    setError(response.message);
                }
            }), function (response, textStatus, errorThrown) {
                setError("Unable to get timesheet data => ", response.status, textStatus, errorThrown, response.responseJSON.error.message, response.responseJSON.error.tip);
            });
        }
    });
})();

function validateForm(apiKeyRequired, startDateRequired) {
    let msg = "";

    if (apiKeyRequired !== false) {
        let apiKeyInput = document.getElementById("apiKey");
        if (!apiKeyInput || !apiKeyInput.value) {
            msg += "API key is required"
        }
    }

    if (startDateRequired !== false) {
        let startDateInput = document.getElementById("startDate");
        if (!startDateInput || !startDateInput.value) {
            if (msg) {
                msg += "\n";
            }

            msg += "Start date is required"
        }
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

function sendActionToContentScript(action, data) {
    return new Promise(function (resolve)
    {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: action,
                data: data
            }, resolve);
        });
    });
}

function getTogglData(url, apiKey) {
    return $.ajax({
        dataType: "json",
        headers: {
            "Authorization": "Basic " + btoa(apiKey + ":api_token")
        },
        method: "GET",
        url: url,
    });
}

function postTogglData(url, apiKey, data) {
    return $.ajax({
        data: JSON.stringify(data),
        dataType: "json",
        headers: {
            "Authorization": "Basic " + btoa(apiKey + ":api_token"),
            "Content-Type": "application/json"
        },
        method: "POST",
        processData: false,
        url: url
    });
}

function getTogglCredentials() {
    let apiKeyInput = document.getElementById("apiKey");
    let apiKey = apiKeyInput.value;

    return getDefaultTogglWorkspace(apiKey, getTogglWorkspace)
        .then(function (workspaceId) {
            if (workspaceId) {
                return { apiKey: apiKey, workspaceId: workspaceId };
            } else {
                setError("Unable to determine Toggl workspace");
            }
        }, function (response, textStatus, errorThrown) {
            setError("Unable to get a default workspace => ", response.status, textStatus, errorThrown);
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
    return getTogglData("https://www.toggl.com/api/v8/workspaces", apiKey);
}

function getTogglWorkspaceClients(apiKey, workspaceId) {
    return getTogglData("https://www.toggl.com/api/v8/workspaces/" + workspaceId + "/clients", apiKey);
}

function createTogglClient(apiKey, workspaceId, clientName) {
    return postTogglData("https://www.toggl.com/api/v8/clients", apiKey, { client: { name: clientName, wid: workspaceId } });
}

function getTogglWorkspaceProjects(apiKey, workspaceId) {
    return getTogglData("https://www.toggl.com/api/v8/workspaces/" + workspaceId + "/projects", apiKey);
}

function createTogglProject(apiKey, workspaceId, projectName, clientId) {
    return postTogglData("https://www.toggl.com/api/v8/projects", apiKey, { project: { name: projectName, wid: workspaceId, cid: clientId, is_private: true } });
}

function mapToggleProjectsToClients(clients, projects) {
    let mappedClients = [];

    for (let i = 0; i < clients.length; i++) {
        mappedClients.push({ name: clients[i].name, id: clients[i].id, projects: [] });
    }

    for (let j = 0; j < projects.length; j++) {
        for (let k = 0; k < mappedClients.length; k++) {
            if (mappedClients[k].id === projects[j].cid) {
                mappedClients[k].projects.push(projects[j].name);
                break;
            }
        }
    }

    return mappedClients;
};

function markNewClientsAndProjects(existingClients, clientsToCopy) {
    for (let i = 0; i < clientsToCopy.length; i++) {
        for (let j = 0; j < existingClients.length; j++) {
            if (clientsToCopy[i].name.indexOf(existingClients[j].name) > -1) {
                clientsToCopy[i].new = false;
                clientsToCopy[i].id = existingClients[j].id;
                for (let k = 0; k < clientsToCopy[i].tasks.length; k++) {
                    for (let l = 0; l < existingClients[j].projects.length; l++) {
                        if (clientsToCopy[i].tasks[k].name.indexOf(existingClients[j].projects[l]) > -1) {
                            clientsToCopy[i].tasks[k].new = false;
                            break;
                        }
                    }
                }
                break;
            }
        }
    }

    return clientsToCopy;
}

function createClientsAndProjects(clientsToCopy, apiKey, workspaceId, i) {
    if (i === undefined) {
        i = 0;
    }

    for (; i < clientsToCopy.length; i++) {
        if (clientsToCopy[i].new === false) {
            let projectsResponse = createProjects(clientsToCopy[i].tasks, clientsToCopy[i].id, apiKey, workspaceId);
            if (projectsResponse !== undefined) {
                if (typeof (projectsResponse) === "number") {
                    continue;                    
                } else {
                    return projectsResponse.then(function (result) {
                        let response = createClientsAndProjects(clientsToCopy, apiKey, workspaceId, i + 1);
                        if (response) {
                            return response;
                        }
                    });
                }
            }
        } else {
            return createTogglClient(apiKey, workspaceId, clientsToCopy[i].name).then(function (client) {
                let projectsResponse = createProjects(clientsToCopy[i].tasks, client.data.id, apiKey, workspaceId);
                if (projectsResponse !== undefined) {
                    if (typeof (projectsResponse) === "number") {
                        return projectsResponse;
                    } else {
                        return projectsResponse.then(function (result) {
                            let response = createClientsAndProjects(clientsToCopy, apiKey, workspaceId, i + 1);
                            if (response) {
                                return response;
                            }
                        });
                    }
                }
            });
        }
    }
}

function createProjects(projectsToCopy, clientId, apiKey, workspaceId, i) {
    if (i === undefined) {
        i = 0;
    }

    for (; i < projectsToCopy.length; i++) {
        if (projectsToCopy[i].new === false) {
            continue;
        } else {
            return createTogglProject(apiKey, workspaceId, projectsToCopy[i].name, clientId).then(function (project) {
                let createProjectsResponse = createProjects(projectsToCopy, clientId, apiKey, workspaceId, i + 1);
                if (createProjectsResponse !== undefined && typeof (createProjectsResponse) === "number") {
                    return createProjectsResponse + 1;
                } else {
                    return createProjectsResponse;
                }
            });
        }
    }

    return { responsePromise: undefined, projectsCreated: 0 };
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
    return getTogglData("https://toggl.com/reports/api/v2/details?workspace_id=" + workspaceId +
        "&user_agent=toggle_to_openair&since=" + startDate + "&until=" + endDate +
        "&page=" + page + "&order_field=date&order_desc=off", apiKey);
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