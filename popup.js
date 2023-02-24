var roundTimeEnum = { all: 0, billable: 1, none: 2 };
var descriptionFieldEnum = { description: 0, notes: 1, both: 2, none: 3 };

var cancellationToken;

var delim = "||||".toString()
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
            apiKey: apiKeyInput.value || ""
        });

        setupWorkspaces(apiKeyInput.value);
    });

    chrome.storage.sync.get("apiKey", function (data) {
        let apiKeyValue = data.apiKey || "";
        if (apiKeyValue !== "") {
            apiKeyInput.value = apiKeyValue;

            setupWorkspaces(apiKeyValue);
        }
    });
})();

(function watchWorkspace() {
    let workspaceSelect = document.getElementById("workspace");
    workspaceSelect.addEventListener("change", function (arg1, arg2, arg3) {
        let selectedOptions = "";

        for (let i = 0; i < workspaceSelect.options.length; i++) {
            if (workspaceSelect.options[i].selected) {
                selectedOptions = selectedOptions + "|" + workspaceSelect.options[i].value;
            }
        }

        chrome.storage.sync.set({
            workspace: selectedOptions.substring(1)
        });
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

(function setupRoundTime() {
    let roundTimeInput = document.getElementById("roundTime");
    roundTimeInput.addEventListener("change", function () {
        chrome.storage.sync.set({
            roundTime: roundTimeInput.options[roundTimeInput.selectedIndex].value
        });
    });

    chrome.storage.sync.get("roundTime", function (data) {
        let roundTimeValue = "";

        if (typeof(data.roundTime) === "boolean") {
            roundTimeValue = data.roundTime ? roundTimeEnum.all : roundTimeEnum.none;
        } else {
            roundTimeValue = data.roundTime || roundTimeEnum.none;
        }

        roundTimeInput.selectedIndex = roundTimeValue;
    });
})();

(function setupDescriptionField() {
    let descriptionFieldInput = document.getElementById("descriptionField");
    descriptionFieldInput.addEventListener("change", function () {
        chrome.storage.sync.set({
            descriptionField: descriptionFieldInput.options[descriptionFieldInput.selectedIndex].value
        });
    });

    chrome.storage.sync.get("descriptionField", function (data) {
        let descriptionFieldValue = data.descriptionField || descriptionFieldEnum.description;
        descriptionFieldInput.selectedIndex = descriptionFieldValue;
    });
})();

(function setupGroupByTask() {
    let groupByTaskInput = document.getElementById("groupByTask");
    groupByTaskInput.addEventListener("change", function () {
        chrome.storage.sync.set({
            groupByTask: groupByTask.checked || false
        });
    });

    chrome.storage.sync.get("groupByTask", function (data) {
        let groupByTaskValue = data.groupByTask || false;
        groupByTaskInput.checked = groupByTaskValue;
    });
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
            let projectsToChange = [];
            var credentials = {};

            sendActionToContentScript("getProjects", undefined).then(function (response) {
                if (response === undefined) {
                    setError("Unable to determine the response for getProjects");
                } else if (response.success) {
                    if (response.projects.length === 0) {
                        setError("No projects to import!");
                    } else {
                        clientsToChange = response.projects;

                        return getTogglCredentials(getSelectedTogglWorkspace);
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
                existingClients = mapToggleProjectsToClients(existingClients || [],  projects || []);

                let dataToChange = markClientsAndProjects(existingClients, clientsToChange);

                projectsToChange = dataToChange.projectsToChange;

                return createClientsAndProjects(dataToChange.clientsToChange, credentials.apiKey, credentials.workspaceId);
            }), function (response, textStatus, errorThrown) {
                setError("Unable to get projects => ", response.status, textStatus, errorThrown);
                cancelPromiseTransaction();
            }).then(handlePromiseTransaction(function (data) {
                displayToast("Added " + data.clients.toString() + " client(s) and " + data.projects.toString() + " project(s)");

                return changeProjects(projectsToChange, credentials.apiKey);
            })).then(handlePromiseTransaction(function (data) {
                displayToast("Archived " + data.archived.toString() + " project(s) and unarchived " + data.unarchived.toString() + " project(s)");
            }), function (response, textStatus, errorThrown) {
                setError("Unable to archive projects => ", response.status, textStatus, errorThrown);
                cancelPromiseTransaction();
            });
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

            let timeEntryHandler = new TimeEntryHandler(getTogglReportDetails, getDurationForReportDetails);
            
            getTogglCredentials(getSelectedTogglWorkspace).then(function (credentials) {
                if (credentials) {
                    let startDateCtrl = document.getElementById("startDate");

                    return getTimesheetData(credentials.apiKey, credentials.userId, credentials.workspaceId, timeEntryHandler.getMethod, new Date(startDateCtrl.value));
                } else {
                    cancelPromiseTransaction();
                }
            }).then(handlePromiseTransaction(function (timesheetData) {
                let groupByTaskInput = document.getElementById("groupByTask");
                let groupByTask = groupByTaskInput.checked;

                let aggregatedTimesheetData = aggregateTimesheetData(timesheetData, groupByTask, timeEntryHandler.getDuration);

                let descriptionFieldInput = document.getElementById("descriptionField");
                let descriptionField = descriptionFieldInput.selectedIndex;

                let roundTimeInput = document.getElementById("roundTime");
                let roundTime = roundTimeInput.selectedIndex;

                return sendActionToContentScript("loadTimesheetData", { "timesheetData": aggregatedTimesheetData, "roundTime": roundTime, "descriptionField": descriptionField, "groupByTask": groupByTask });
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
        let classes = control.getAttribute("class");
        if (visibility) {
            control.setAttribute("class", classes.replace(/hide/g, "").trim());
        } else {
            control.setAttribute("class", classes + " hide");
        }
    } else {
        console.error("Unable to find the control to set visibility => ", controlId);
    }
}

function setError(msg) {
    for (let i = 1; i < arguments.length; i++) {
        if (i === 1) {
            msg += " " + arguments[i].toString();
        } else {
            msg += ", " + arguments[i].toString();
        }
    }

    displayToast(msg, true);
}

function displayToast(msg, isError) {
    setVisibility("loading", false);

    let toaster = document.getElementById("toaster");
    if (toaster) {
        if (toaster.getAttribute("class").indexOf("hide") >= 0) {
            let classes = toaster.getAttribute("class");
            if (isError) {
                toaster.setAttribute("class", classes + " error");
            } else {
                toaster.setAttribute("class", classes.replace(/error/g, "").trim());
            }

            toaster.firstElementChild.firstElementChild.innerText = msg;
            setVisibility("toaster", true);
            setTimeout(function () {
                setVisibility("toaster", false);
            }, Math.min(Math.max(msg.length * 150, 3000), 7000)); // Between 3000 and 7000
        } else {
            toaster.firstElementChild.firstElementChild.innerText += "\n" + msg;
        }
    } else {
        console.error("Unable to find toaster.  Reverting to alert");
        alert(msg);
    }

    if (isError) {
        console.error(msg);
    } else {
        console.log(msg);
    }
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

function putTogglData(url, apiKey, data) {
    return $.ajax({
        data: JSON.stringify(data),
        dataType: "json",
        headers: {
            "Authorization": "Basic " + btoa(apiKey + ":api_token"),
            "Content-Type": "application/json"
        },
        method: "PUT",
        processData: false,
        url: url
    });
}

function getTogglCredentials(workspaceFunction) {
    let apiKeyInput = document.getElementById("apiKey");
    let apiKey = apiKeyInput.value;
    let userId;

    return getTogglUserId(apiKey)
        .then(function(response) {
            if (response) {
                userId = response.data.id;

                return getDefaultTogglWorkspace(apiKey, workspaceFunction)
            } else {
                setError("Unable to determine Toggl user id");
            }
        }, function (response, textStatus, errorThrown) {
            setError("Unable to get user id => ", response.status, textStatus, errorThrown);
        }).then(function (workspaceId) {
            if (workspaceId) {
                return { apiKey: apiKey, userId: userId, workspaceId: workspaceId };
            } else {
                setError("Unable to determine Toggl workspace");
            }
        }, function (response, textStatus, errorThrown) {
            setError("Unable to get a default workspace => ", response.status, textStatus, errorThrown);
        });
}

function getTogglUserId(apiKey) {
    return getTogglData("https://api.track.toggl.com/api/v8/me", apiKey);
}

function setupWorkspaces(apiKey) {
    let workspaceSelect = document.getElementById("workspace");
    if (workspaceSelect) {
        for (let i = workspaceSelect.options.length - 1; i > 0; i--) {
            workspaceSelect.options.remove(i);
        }

        startPromiseTransaction();

        return getTogglWorkspaces(apiKey).then(handlePromiseTransaction(function (workspaces, textStatus, response) {
            return new Promise(function(resolve) {
                chrome.storage.sync.get("workspace", function (data) {
                    let workspaceValue = data.workspace || "";

                    for (let i = 0; i < workspaces.length; i++) {
                        workspaces[i].default = workspaceValue.indexOf(workspaces[i].id) > -1;
                        console.log(workspaces[i].name, workspaceValue.indexOf(workspaces[i].id) > -1);

                    }

                    resolve(workspaces);
                });
            });
        }), function (response, textStatus, errorThrown) {
                if (response.status === 403) {
                    setError("Unable to login to Toggl.  Please verify API Key.");
                } else {
                    setError("Error getting workspaces => ", response.status, textStatus, errorThrown);
                }

                cancelPromiseTransaction();
        }).then(handlePromiseTransaction(function(workspaces) {
            if (workspaces.length == 0) {
                setError("Unable to find a Toggl workspace");
            } else {
                for (let i = 0; i < workspaces.length; i++) {
                    workspaceSelect.options.add(new Option(workspaces[i].name, workspaces[i].id, false, workspaces[i].default));
                    console.log(workspaces[i].name, workspaces[i].default);
                }

                if (workspaceSelect.selectedIndex === 0 && workspaces.length === 1) {
                    workspaceSelect.selectedIndex = 1;
                    workspaceSelect.options[1].selected = true;
                    if ("createEvent" in document) {
                        var evt = document.createEvent("HTMLEvents");
                        if (evt) {
                            evt.initEvent("change", true, false);
                            selected = workspaceSelect.dispatchEvent(evt);
                        }
                    } else if ("fireEvent" in workspaceSelect) {
                        workspaceSelect.fireEvent("onchange");
                    } else {
                        console.log("Not sure how to call change on workspace select");
                    }
                }
            }
        }));
    }
}

function getDefaultTogglWorkspace(apiKey, workspaceFunction) {
    if (typeof (workspaceFunction) === "function") {
        return workspaceFunction(apiKey).then(function (workspaces, textStatus, response) {
            if (workspaces.length == 1) {
                return workspaces[0].id;
            } else if (workspaces.length == 0) {
                setError("Unable to find a Toggl workspace");
            } else {
                let workspaceId = "";

                for (let i = 0; i < workspaces.length; i++) {
                    workspaceId = workspaceId + "|" + workspaces[i].id;
                }

                return workspaceId.substring(1);
            }
        }, function (response, textStatus, errorThrown) {
            if (response.status === 403) {
                setError("Unable to login to Toggl.  Please verify API Key.");
            } else {
                setError("Error getting workspaces => ", response.status, textStatus, errorThrown);
            }
        });
    } else {
        console.log("workspaceFunction is not a function.  Please pass a function to get a Toggl workspace.");
        setError("Unable to get credentials.  Please submit a bug.");

        return undefined;
    }
}

function getSelectedTogglWorkspace() {
    return new Promise(function (resolve) {
        let workspaceSelect = document.getElementById("workspace");
        if (workspaceSelect) {
            let workspaces = [];

            for (let i = 0; i < workspaceSelect.options.length; i++) {
                if (workspaceSelect.options[i].selected) {
                    workspaces.push({ name: workspaceSelect.options[i].text, id: workspaceSelect.options[i].value })
                }
            }
            if (workspaces.length === 0) {
                setError("Please select a workspace");
            } else {
                return resolve(workspaces);
            }
        } else {
            setError("Error gettings workspace");
        }
    });
}

function getTogglWorkspaces(apiKey) {
    return getTogglData("https://api.track.toggl.com/api/v8/workspaces", apiKey);
}

function getTogglWorkspaceClients(apiKey, workspaceId) {
    return getTogglData("https://api.track.toggl.com/api/v8/workspaces/" + workspaceId + "/clients", apiKey);
}

function createTogglClient(apiKey, workspaceId, clientName) {
    return postTogglData("https://api.track.toggl.com/api/v8/clients", apiKey, { client: { name: clientName, wid: workspaceId } });
}

function getTogglWorkspaceProjects(apiKey, workspaceId) {
    return getTogglData("https://api.track.toggl.com/api/v8/workspaces/" + workspaceId + "/projects?active=both", apiKey);
}

function createTogglProject(apiKey, workspaceId, projectName, clientId) {
    return postTogglData("https://api.track.toggl.com/api/v8/projects", apiKey, { project: { name: projectName, wid: workspaceId, cid: clientId, is_private: true } });
}

function archiveTogglProject(apiKey, projectId) {
    return putTogglData("https://api.track.toggl.com/api/v8/projects/" + projectId, apiKey, { project: { is_private: true, active: false } });
}

function unarchiveTogglProject(apiKey, projectId) {
    return putTogglData("https://api.track.toggl.com/api/v8/projects/" + projectId, apiKey, { project: { is_private: true, active: true } });
}

function mapToggleProjectsToClients(clients, projects) {
    let mappedClients = [];

    for (let i = 0; i < clients.length; i++) {
        mappedClients.push({ name: clients[i].name, id: clients[i].id, projects: [] });
    }

    for (let j = 0; j < projects.length; j++) {
        for (let k = 0; k < mappedClients.length; k++) {
            if (mappedClients[k].id === projects[j].cid) {
                mappedClients[k].projects.push({ id: projects[j].id, name: projects[j].name, active: projects[j].active });
                break;
            }
        }
    }

    return mappedClients;
};

function markClientsAndProjects(existingClients, clientsToChange) {
    let projectsToChange = [];

    for (let i = 0; i < clientsToChange.length; i++) {
        for (let j = 0; j < existingClients.length; j++) {
            if ((clientsToChange[i].name.length > 0) && (clientsToChange[i].name.indexOf(existingClients[j].name) > -1)) {
                clientsToChange[i].new = false;
                clientsToChange[i].id = existingClients[j].id;

                // Marking projects that already exist in Toggl
                for (let k = 0; k < clientsToChange[i].tasks.length; k++) {
                    for (let l = 0; l < existingClients[j].projects.length; l++) {
                        if (clientsToChange[i].tasks[k].name.indexOf(existingClients[j].projects[l].name) > -1) {
                            clientsToChange[i].tasks[k].new = false;
                            existingClients[j].projects[l].keep = true;
                            break;
                        }
                    }
                }

                // Looping through to add the projects that need to be archived/unarchived
                for (let m = 0; m < existingClients[j].projects.length; m++) {
                    if (existingClients[j].projects[m].keep === undefined) {
                        projectsToChange.push({ projectId: existingClients[j].projects[m].id, active: false });
                    } else if (existingClients[j].projects[m].keep === true && existingClients[j].projects[m].active === false) {
                        projectsToChange.push({ projectId: existingClients[j].projects[m].id, active: true });
                    }
                }
                break;
            }
        }
    }

    return { clientsToChange: clientsToChange, projectsToChange: projectsToChange };
}

function createClientsAndProjects(clientsToCopy, apiKey, workspaceId, i) {
    let stats = {
        clients: 0,
        projects: 0
    };

    let incrementStats = function (newStats) {
        stats.projects += newStats.projects;
        stats.clients += newStats.clients;
        return stats;
    };

    let createDataForClient = function (projectsToCopy, clientId) {
        let projectsResponse = createProjects(projectsToCopy, clientId, apiKey, workspaceId);
        if (projectsResponse !== undefined) {
            if (typeof (projectsResponse) === "number") {
                stats.projects += projectsResponse;
                return stats;
            } else { // It is a Promise
                return projectsResponse.then(function (projects) {
                    stats.projects += projects;

                    let response = createClientsAndProjects(clientsToCopy, apiKey, workspaceId, i + 1);
                    if ((response !== undefined) && (response.clients !== undefined)) {
                        return incrementStats(response);
                    } else {
                        return response.then(function (clientsAndProjects) {
                            return incrementStats(clientsAndProjects);
                        });
                    }
                });
            }
        }
    };

    if (i === undefined) {
        i = 0;
    }

    for (; i < clientsToCopy.length; i++) {
        if (clientsToCopy[i].new === false) {
            let result = createDataForClient(clientsToCopy[i].tasks, clientsToCopy[i].id);
            if ((result !== undefined) && (result.clients !== undefined)) {
                continue;
            } else {
                return result;
            }
        } else {
            return createTogglClient(apiKey, workspaceId, clientsToCopy[i].name).then(function (client) {
                stats.clients++;

                return createDataForClient(clientsToCopy[i].tasks, client.data.id);
            });
        }
    }

    return stats;
}

function createProjects(projectsToCopy, clientId, apiKey, workspaceId, i) {
    let projectHandlerResponse;

    if (i === undefined) {
        i = 0;
    }

    for (; i < projectsToCopy.length; i++) {
        if (projectsToCopy[i].new === false || projectsToCopy[i].active !== undefined) {
            continue;
        } else {
            projectHandlerResponse = createTogglProject(apiKey, workspaceId, projectsToCopy[i].name, clientId);
        }

        if (projectHandlerResponse !== undefined) {
            return projectHandlerResponse.then(function (project) {
                let createProjectsResponse = createProjects(projectsToCopy, clientId, apiKey, workspaceId, i + 1);
                if (createProjectsResponse !== undefined && typeof (createProjectsResponse) === "number") {
                    return createProjectsResponse + 1;
                } else {
                    return createProjectsResponse.then(function (projects) {
                        return projects + 1;
                    });
                }
            });
        }
    }

    return 0;
}

function changeProjects(projectsToChange, apiKey, stats, i) {
    if (i === undefined) {
        i = 0;
    }

    if (stats === undefined) {
        stats = { archived: 0, unarchived: 0 };
    }

    for (; i < projectsToChange.length; i++) {
        if (projectsToChange[i].active === true) {
            return unarchiveTogglProject(apiKey, projectsToChange[i].projectId).then(function (project) {
                let createProjectsResponse = changeProjects(projectsToChange, apiKey, stats, i + 1);
                if (createProjectsResponse !== undefined && (createProjectsResponse.unarchived !== undefined)) {
                    stats.unarchived = stats.unarchived + 1;
                    return stats;
                } else {
                    return createProjectsResponse.then(function (tempStats) {
                        tempStats.unarchived = tempStats.unarchived + 1;
                        return tempStats;
                    });
                }
            });
        } else {
            return archiveTogglProject(apiKey, projectsToChange[i].projectId).then(function (project) {
                let createProjectsResponse = changeProjects(projectsToChange, apiKey, stats, i + 1);
                if (createProjectsResponse !== undefined && (createProjectsResponse.archived !== undefined)) {
                    stats.archived = stats.archived + 1;
                    return stats;
                } else {
                    return createProjectsResponse.then(function (tempStats) {
                        tempStats.archived = tempStats.archived + 1;
                        return tempStats;
                    });
                }
            });
        }
    }

    return { archived: 0, unarchived: 0 };
}

function getEndDate(startDate) {
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endDate;
}

function getTimesheetData(apiKey, userId, workspaceId, timesheetDataMethod, startDate) {
    if (timesheetDataMethod === undefined || typeof(timesheetDataMethod) !== "function") {
        console.log("Timesheet data method not supplied");
        setError("Unable to get Toggl time entries.  Please log a bug.");
    } else {
        return new Promise(function (resolve) {
            chrome.storage.local.get("endDate", resolve);
        }).then(function (data) {
            return data.endDate || "";
        }).then(function (endDate) {
            endDate = (endDate === "") ? getEndDate(startDate) : new Date(endDate);
    
            let workspaces = workspaceId.split("|");
            let timesheetData = [];
            let timesheetPromise = Promise.resolve();

            for (let i = 0; i < workspaces.length; i++) {
                timesheetPromise = timesheetPromise.then(function() {
                    return timesheetDataMethod(apiKey, userId, workspaces[i], startDate, endDate, 1);
                }).then(function(data) {
                    timesheetData = timesheetData.concat(data);
                    return timesheetData;
                });
            }

            return timesheetPromise;
        });
    }
}

function getTogglReportDetails(apiKey, userId, workspaceId, startDate, endDate, page) {
    let detailsResponse =
        getTogglReportDetailsByPage(apiKey, userId, workspaceId, startDate, endDate, page);

    return detailsResponse.then(function (response) {
        let reportDetails = response.data;

        if (page === 1) {
            console.log("Toggl report details total count and hours => ", response.total_count, response.total_grand / 1000.0 / 60.0 / 60.0);
        }

        if ((response.per_page * page) < response.total_count) {
            let reportDetailReponse = getTogglReportDetails(apiKey, userId, workspaceId, startDate, endDate, page + 1)
            if (Array.isArray(reportDetailReponse)) {
                return reportDetails.concat(reportDetailReponse);
            } else {
                return reportDetailReponse.then(function (response) {
                    return reportDetails.concat(response);
                });
            }
        } else {
            return reportDetails;
        }
    });
}

function getTogglReportDetailsByPage(apiKey, userId, workspaceId, startDate, endDate, page) {

    return getTogglData("https://api.track.toggl.com/reports/api/v2/details?workspace_id=" + workspaceId +
        "&user_agent=toggle_to_openair&user_ids=" + userId +
        "&since=" + startDate.toISOString().substring(0, 10) +
        "&until=" + endDate.toISOString().substring(0, 10) +
        "&page=" + page + "&order_field=date&order_desc=off", apiKey);
}

function getTogglTimeEntries(apiKey, userId, workspaceId, startDate, endDate) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return getTogglData("https://api.track.toggl.com/api/v8/time_entries?workspace_id=" + workspaceId +
        "&user_agent=toggle_to_openair&start_date=" + startDate.toJSON() + "&end_date=" + endDate.toJSON(), apiKey);
}

function generateAggregateKey(entry, groupByTask) {
    if (groupByTask) {
        return entry.client + delim + entry.project + delim + entry.is_billable.toString();
    } else {
        return entry.client + delim + entry.project + delim + entry.is_billable.toString() + delim + entry.description;
    }
}

function aggregateTimesheetData(timesheetData, groupByTask, getDuration) {
    let aggregateData = {};

    for (let i = 0, dataLength = timesheetData.length; i < dataLength; i++) {
        let entry = timesheetData[i];
        entry.start = entry.start.substring(0, 10);
        entry.dur = getDuration(entry);
        entry.is_billable = isEntryBillable(entry);

        let entryKey = generateAggregateKey(entry, groupByTask);
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

function getDurationForReportDetails(entry) {
    return entry.dur / 3600000.0; // 60 (mins) * 60 (secs) * 1000 (ms)
}

function getDurationForTimeEntries(entry) {
    return entry.duration / 3600.0; // 60 (mins) * 60 (secs)
}

function isEntryBillable(entry) {
    if (entry.is_billable === true) {
        return true;
    } else {
        let reg = new RegExp(/\W*billable\W*/i);

        return reg.test(entry.tags.join());
    }
}

function TimeEntryHandler(getMethod, getDuration) {
    let self = this;

    self.getMethod = getMethod;
    self.getDuration = getDuration;
}