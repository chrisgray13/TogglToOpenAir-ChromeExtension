var elements = {
    loadingImage: "<div id='loadingImage' style='background: #3F3F3F;width: 100%;height: 100%;position: absolute;top: 0px;left: 0px;z-index: 10000;opacity: .8;text-align: center;'><span style='font-size: 20em;color: #000000;padding: 20px;'>Loading</span></div>",
    getDayDeleteButton: function(i) {
        return "<i class=\"sprites delete_row\" id=\"deleteDay" + i + "\"></i>";
    },
};

var controls = getControls();

const delim = "||||".toString()

function getControls() {

    return getOldUIControls();
}

function getOldUIControls() {
    return {
        timesheetElementRowFormat: "ts_c#_r#",
        
        getLoadingImage: function() { return document.getElementById("loadingImage"); },
        
        getTimesheetDateRange: function() { return document.getElementById("timesheet_data_range"); },
        
        getTimesheetDataRows: function() { return document.querySelectorAll("table.timesheet tbody tr"); },
        
        getFirstTimesheetDataHoursColumnInput: function() { return document.querySelector("table.timesheet tbody td.timesheetHoursFirst input"); },
        
        getWeekdayHourHeaders: function() { return document.querySelectorAll("th.timesheetFixedColumn span.weekDay"); },
        
        getTimesheetDataLastRow: function() { return document.querySelector("table.timesheet tbody tr.gridDataEmptyRow select"); },
        
        getTimesheetDataHourInputs: function() { return document.getElementsByClassName("timesheetInputHour"); },
        
        getNotesDescription: function() { return document.getElementById("tm_desc"); },
        
        getNotesNotes: function() { return document.getElementById("tm_notes"); },
        
        getNotesOkButton: function() { return document.querySelector(".btn-oa.dialogOkButton"); },
        
        getWeekDayHourHeader: function(i) { return document.querySelector("th.timesheetFixedColumn" + i + " span.weekDay"); },

        getMonthDayHourHeader: function(i) { return document.querySelector("th.timesheetFixedColumn" + i + " span.monthDay"); },
        
        getProject: function(row) { return document.getElementById("ts_c1_r" + row); },
        getProjectId: function(row) { return "ts_c1_r" + row; },

        getTask: function(row) { return document.getElementById("ts_c2_r" + row); },
        getTaskId: function(row) { return "ts_c2_r" + row; },

        getTimeType: function(row) { return document.getElementById("ts_c3_r" + row); },
        getTimeTypeId: function(row) { return "ts_c3_r" + row; },

        getHours: function(row, col) { return document.getElementById("ts_c" + col + "_r" + row); },

        getNotes: function(row, col) { return document.getElementById("ts_notes_c" + col + "_r" + row); },
    };
}

function getNewUIControls() {
    // Not ready for prime-time
    return {
        timesheetElementRowFormat: "ts_c#_r#",
        
        getLoadingImage: function() { return document.getElementById("loadingImage"); },
        
        getTimesheetDateRange: function() { return document.getElementById("timesheet_data_range"); },
        
        getTimesheetDataRows: function() { return document.querySelectorAll("table.timesheet tbody tr"); },
        
        getFirstTimesheetDataHoursColumnInput: function() { return document.querySelector("table.timesheet tbody td.timesheetHoursFirst input"); },
        
        getWeekdayHourHeaders: function() { return document.querySelectorAll("th.timesheetFixedColumn span.weekDay"); },
        
        getTimesheetDataLastRow: function() { return document.querySelector("table.timesheet tbody tr.gridDataEmptyRow select"); },
        
        getTimesheetDataHourInputs: function() { return document.getElementsByClassName("timesheetInputHour"); },
        
        getNotesDescription: function() { return document.getElementById("tm_desc"); },
        
        getNotesNotes: function() { return document.getElementById("tm_notes"); },
        
        getNotesOkButton: function() { return document.querySelector(".btn-oa.dialogOkButton"); },
        
        getWeekDayHourHeader: function(i) { return document.querySelector("th.timesheetFixedColumn" + i + " span.weekDay"); },

        getMonthDayHourHeader: function(i) { return document.querySelector("th.timesheetFixedColumn" + i + " span.monthDay"); },
        
        getProject: function(row) { return document.getElementById("ts_c1_r" + row); },
        getProjectId: function(row) { return "ts_c1_r" + row; },

        getTask: function(row) { return document.getElementById("ts_c2_r" + row); },
        getTaskId: function(row) { return "ts_c2_r" + row; },

        getTimeType: function(row) { return document.getElementById("ts_c3_r" + row); },
        getTimeTypeId: function(row) { return "ts_c3_r" + row; },

        getHours: function(row, col) { return document.getElementById("ts_c" + col + "_r" + row); },

        getNotes: function(row, col) { return document.getElementById("ts_notes_c" + col + "_r" + row); },
    };
}

var roundTimeEnum = { all: 0, billable: 1, none: 2 };
var descriptionFieldEnum = { description: 0, notes: 1, both: 2, none: 3 };

var errors;
var errorCount;
function setError(msg) {
    for (let i = 1; i < arguments.length; i++) {
        if (i === 1) {
            msg += " " + ((arguments[i]) ? arguments[i].toString() : "undefined");
        } else {
            msg += ", " + ((arguments[i]) ? arguments[i].toString() : "undefined");
        }
    }

    errors += "\n- " + msg;
    errorCount++;

    console.log("ERROR: " + msg);
}

function setOpenAirNotificationVisibility(visibility, message) {
    let notification = document.getElementsByClassName("notificationEnvelopeOutside");

    if (visibility && (!notification || (notification.length === 0))) {
        try {
            OA.view.Notification.prototype.create(message, "Confirm", []);
        } catch { }

        notification = document.getElementsByClassName("notificationEnvelopeOutside");
    }

    if (notification && (notification.length > 0)) {
        let content = document.getElementsByClassName("notificationTitleContent");
        if (content && (content.length > 0)) {
            content[0].innerText = message || "";
        } else {
            console.log("Unable to set the OpenAir notification's content => ", message);
        }

        let style = notification[0].getAttribute("style");
        if (visibility) {
            notification[0].setAttribute("style", style.replace(/display:.?none/g, "display: block").trim());
        } else {
            notification[0].setAttribute("style", style.replace(/display:.?block/g, "display: none").trim());
        }
    } else {
        console.log("Unable to find the OpenAir notification");
    }

}

(function addListeners() {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        errors = "";
        errorCount = 0;

        if (request.action === "loading") {
            let bodyElement = document.getElementsByTagName("body")[0];
            bodyElement.innerHTML = bodyElement.innerHTML + elements.loadingImage;

            sendResponse({ success: true });
        } else if (request.action === "loadTimesheetData") {
            createTimesheet(request.data.timesheetData, request.data.roundTime, request.data.descriptionField);

            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount
            });
        } else if (request.action === "getTimesheetDateRange") {
            let dateRange = getTimesheetDateRange();

            let remainingDateRange = getRemainingTimeEntryRange(dateRange.startDate, dateRange.endDate, getFirstEmptyTimeEntryDayOfTheWeek() - 1);

            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount,
                startDate: remainingDateRange.startDate,
                endDate: remainingDateRange.endDate
            });
        } else if (request.action === "addDeleteButtonsByDay") {
            addDeleteButtonsByDay();
            
            sendResponse({ success: true });
        } else if (request.action === "getProjects") {
            sendResponse({
                success: errorCount === 0,
                message: errors,
                numberOfErrors: errorCount,
                projects: getProjects()
            });
        }
    });
})();

function addDeleteButtonsByDay() {
    let deleteBtn;

    for (let i = 1; i <= 7; i++) {
        let hourColumnCtrl = controls.getWeekDayHourHeader(i);
        if (hourColumnCtrl) {
            hourColumnCtrl.innerHTML = hourColumnCtrl.innerHTML + " " + elements.getDayDeleteButton(i);
            deleteBtn = document.getElementById("deleteDay" + i);
            deleteBtn.addEventListener("click", deleteDaysTimeEntries);
        }
    }
}

function deleteDaysTimeEntries(event) {
    var dayOfWeek = 8 - parseInt(event.currentTarget.id.substring(9));
    let columnOffset = getTimeStartColumnPosition() - 1;

    setOpenAirNotificationVisibility(true, "Deleting time entries!  Takes about 10 seconds.");

    setTimeout(function() {
        let numberOfRows = controls.getTimesheetDataRows().length;
        let i;

        for (i = 1; i < numberOfRows; i++) {
            addHours(
                i,
                { "columnOffset": columnOffset, "dayOfWeek": dayOfWeek, "dayOfMonth": undefined },
                "",
                { "field": descriptionFieldEnum.both, "value": "" }
            );
        }
        
        setOpenAirNotificationVisibility(false, "");
    }, 500);
}

function roundDuration(duration, isBillable, roundTime) {
    let roundDecimal = function (value, precision) {
        return Number(Math.round(value + 'e'+ precision) + 'e-' + precision);
    };

    if (roundTime === roundTimeEnum.all) {
        // Automatically round anything below .125 to .25 -- mostly need for billable time
        if ((duration > 0.000000) && (duration < 0.125000)) {
            return 0.250000;
        } else {
            let overage = duration % 0.25000;
            if (overage >= 0.125000) {
                return roundDecimal(duration + (0.25000 - overage), 2);
            } else {
                return roundDecimal(duration - overage, 2);
            }
        }
    } else if ((roundTime === roundTimeEnum.billable) && isBillable) {
        // Always round up for billable time
        let overage = duration % 0.25000;

        return roundDecimal(duration + (0.25000 - overage), 2);
    } else {
        return roundDecimal(duration, 2);
    }
}

function getDayOfMonth(date) {
    return new Date(date).getUTCDate();
}

function getSundayPosition() {
    let hourColumnCtrls = controls.getWeekdayHourHeaders();

    if (hourColumnCtrls) {
        for (let i = 0; i < hourColumnCtrls.length; i++) {
            if (hourColumnCtrls[i].innerHTML.startsWith("Sun")) {
                console.log("Found that Sunday is in position " + ++i + " on the timesheet");
                return i;
            }
        }
    }

    return 7;
}

function getDayOfTheWeek(date, sundayPosition) {
    if (sundayPosition < 1 || sundayPosition > 7) {
        setError("Bad usage of sundayPosition in getDateOfTheWeek");
    } else {
        let weekday = new Date(date).getUTCDay() // Sunday = 0
        weekday = weekday + sundayPosition
        if (weekday > 7) {
            weekday = weekday - 7
        }

        return weekday
    }
}

function getTimesheetDateRange() {
    let dateRange = controls.getTimesheetDateRange();
    let startDate, endDate;

    if (dateRange) {
        let datePieces = dateRange.textContent.trim().split(" ");
        if (datePieces.length === 3) {
            let dayPieces = datePieces[1].split("-");
            if (dayPieces.length === 2) {
                startDate = new Date(datePieces[0] + " " + dayPieces[0] + " " + datePieces[2]);
                endDate = new Date(datePieces[0] + " " + dayPieces[1] + " " + datePieces[2]);
            }
        } else if (datePieces.length === 6) {
            startDate = new Date(datePieces[0] + " " + datePieces[1] + " " + datePieces[5]);
            endDate = new Date(datePieces[3] + " " + datePieces[4].replace(",", "") + " " + datePieces[5]);
        } else if (datePieces.length === 7) {
            startDate = new Date(datePieces[0] + " " + datePieces[1] + " " + datePieces[2]);
            endDate = new Date(datePieces[4] + " " + datePieces[5].replace(",", "") + " " + datePieces[6]);
        } else {
            setError("Unable to determine default start date");                    
        }
    }

    return { startDate: startDate, endDate: endDate };
}

function getTimeStartColumnPosition() {
    let startColumnCtrl = controls.getFirstTimesheetDataHoursColumnInput();

    if (startColumnCtrl) {
        return parseInt(startColumnCtrl.id.substring(controls.timesheetElementRowFormat.length - 4).split("_")[0]);
    } else {
        console.log("Unable to find timesheet data hours start column input.  Returning default => 4");
        return 4;
    }
}

function getFirstEmptyTimeEntryDayOfTheWeek() {
    let timeCtrls = controls.getTimesheetDataHourInputs();
    let lastDayWithTimeEntriesColumnIndex = 0;
    let lastDayColumnIndex = 0;

    if (timeCtrls.length == 0) {
        console.log("Unable to find any timesheet hour input controls");
    } else {
        for (let i = 0, length = timeCtrls.length; i < length; i++) {
            lastDayColumnIndex = Math.max(lastDayColumnIndex, timeCtrls[i].id.substring(4).split("_")[0]);

            if (timeCtrls[i].value != "") {
                lastDayWithTimeEntriesColumnIndex = Math.max(lastDayWithTimeEntriesColumnIndex, timeCtrls[i].id.substring(4).split("_")[0]);
            }
        }
    }

    if (lastDayWithTimeEntriesColumnIndex === 0) {
        return 0; // No time entered
    } else if (lastDayWithTimeEntriesColumnIndex === lastDayColumnIndex) {
        return -1; // No empty days
    } else {
        return lastDayWithTimeEntriesColumnIndex - (lastDayColumnIndex - 8 /* Number of days in a week plus 1 to generate first empty day */);
    }
}

function getRemainingTimeEntryRange(startDate, endDate, startDateOffset) {
    if (startDate) {
        if (startDateOffset > 0) {
            startDate.setDate(startDate.getDate() + startDateOffset);
        }

        return { startDate: startDate.toISOString().substring(0, 10), endDate: endDate.toISOString().substring(0, 10) };
    } else {
        return { startDate: undefined, endDate: undefined };
    }
}

function getNumberOfTimeEntries() {
    let lastRow = controls.getTimesheetDataLastRow();
    return lastRow === undefined ? 0 : parseInt(lastRow.id.slice(controls.timesheetElementRowFormat.length - 1)) - 1;
}

function getProjectTaskTimeTypeRowMappings() {
    let projects = {};
    let mappings = {};
    mappings.length = getNumberOfTimeEntries();

    for (let i = 1; i <= mappings.length; i++) {
        let mapping = getTaskInfoFromTimesheet(i);
        if (mapping && mapping.project) {
            let hash = getProjectTaskTimeTypeHash(mapping.project, mapping.task, mapping.timeType);

            if (mappings[hash]) {
                mappings[hash].push(i);
            } else {
                mappings[hash] = [ i ];
            }

            if (projects[mapping.project]) {
                if (projects[mapping.project].tasks[mapping.task]) {
                    if (projects[mapping.project].tasks[mapping.task].timeTypes[mapping.timeType]) {
                        projects[mapping.project].tasks[mapping.task].timeTypes[mapping.timeType].push(i);
                    } else {
                        projects[mapping.project].tasks[mapping.task].timeTypes[mapping.timeType] = [ i ];
                    }
                } else {
                    projects[mapping.project].tasks[mapping.task] = { timeTypes: { [mapping.timeType]: [ i ] } };
                }
            } else {
                projects[mapping.project] = { tasks: { [mapping.task]: { timeTypes: { [mapping.timeType]: [ i ] } } } };
            }
        }
    }

    return { projects: projects, mappings: mappings };
}

function getProjectTaskTimeTypeHash(project, task, timeType) {
    return project + delim + task + delim + timeType;
}

function findProjectTaskTimeTypeRow(mappings, project, alternateProject, task, alternateTask, timeType) {
    let hash = getProjectTaskTimeTypeHash(project, task, timeType);
    if (mappings.mappings[hash]) {
        console.log("Found exact project, task, timeType match => ", project, task, timeType);

        return mappings.mappings[hash].shift();
    } else {
        let mappedProject = undefined;
        let mappedTask = undefined;

        for (let mappedProjectName in mappings.projects) {
            if ((mappedProjectName.indexOf(project) > -1) ||
                (mappedProjectName.indexOf(alternateProject) > -1)) {
                mappedProject = mappings.projects[mappedProjectName];
                break;
            }
        }

        if (mappedProject) {
            for(let mappedTaskName in mappedProject.tasks) {
                if ((mappedTaskName.indexOf(task) > -1) ||
                    (mappedTaskName.indexOf(alternateTask) > -1)) {
                    mappedTask = mappedProject.tasks[mappedTaskName];
                    break;
                }
            }
        }

        if (mappedTask) {
            if (mappedTask.timeTypes[timeType]) {
                console.log("Found partial project, task, timeType match => ", project, task, timeType);

                return mappedTask.timeTypes[timeType].shift();
            }
        }
    }

    console.log("Unable to find project, task, timeType => ", project, task, timeType);

    return undefined;
}

function createTimesheet(timesheetData, roundTime, descriptionField) {
    let mappings = getProjectTaskTimeTypeRowMappings();
    let row = (mappings.mappings.length || 0) + 1;
    let sundayPosition = getSundayPosition();
    let columnOffset = getTimeStartColumnPosition() - 1;

    for (let projectTaskKey in timesheetData) {
        let projectTaskEntries = timesheetData[projectTaskKey];
        let taskInfo = getTaskInfoFromDateEntry(projectTaskKey);
        let timeEntryRow = findProjectTaskTimeTypeRow(mappings, taskInfo.project, taskInfo.alternateProject, taskInfo.task, taskInfo.alternateTask, taskInfo.timeType) || row;

        for (let dateKey in projectTaskEntries) {
            let dateEntry = projectTaskEntries[dateKey];
            let roundedDuration = roundDuration(dateEntry.dur, dateEntry.is_billable, roundTime);
            if (roundedDuration <= 0.0) {
                console.log("Skipping => ", dateEntry.start, dateEntry.client, dateEntry.project, dateEntry.description);
            } else {
                addHours(
                    timeEntryRow,
                    { "columnOffset": columnOffset, "dayOfWeek": getDayOfTheWeek(dateEntry.start, sundayPosition), "dayOfMonth": getDayOfMonth(dateEntry.start) },
                    roundedDuration,
                    { "field": descriptionField, "value": dateEntry.description.replace("'", "\\'") }
                );
            }
        }

        if (timeEntryRow === row) {
            setTaskInfoInTimesheet(row, taskInfo.project, taskInfo.alternateProject, taskInfo.task, taskInfo.alternateTask, taskInfo.timeType);
            row = row + 1;
        }
    }

    let loadingImageElement = controls.getLoadingImage();
    if (loadingImageElement) {
        loadingImageElement.remove();
    }
}

function getTaskInfoFromDateEntry(projectTaskTimeTypeHash) {
    let hashPieces = projectTaskTimeTypeHash.split(delim.toString());

    // Used to find tasks that are labeled Billable
    // E.g. Billable task, billable task, my task - billable, my task [Billable]
    let reg = new RegExp(/\W*billable\W*/i);

    // Remove an Billable text that is just for setting the Billing Type unless using IsBillable
    let cleanTask = hashPieces[2] === "true" ? hashPieces[1] : hashPieces[1].replace(reg, "");

    return {
        project: hashPieces[0],
        alternateProject: mapProject(hashPieces[0]),
        task: cleanTask,
        alternateTask: stripTask(cleanTask),
        timeType: (hashPieces[2] === "true" || reg.test(hashPieces[1])) ? "Billable Time" : "Non-Billable"
    };
}

function selectOptionForControl(selectCtrl, optionValue) {
    let matchingElement;

    for (let i = 0, optionsLength = selectCtrl.options.length; i < optionsLength; i++) {
        if (selectCtrl.options[i].textContent.indexOf(optionValue) > -1) {
            selectCtrl.selectedIndex = i;
            matchingElement = selectCtrl.options[i];
            break;
        }
    }

    return matchingElement;
}

function getTaskInfoFromTimesheet(row) {
    let getSelectedOption = function (selectId) {
        let selectedOption = undefined;

        let selectCtrl = document.getElementById(selectId);
        if (selectCtrl) {
            selectedOption = selectCtrl.selectedOptions[0].text;
        } else {
            console.log("Could not find control => ", selectId);
        }

        return selectedOption;
    };

    console.log("Getting project and task on row => ", row);

    let taskInfo = {};

    taskInfo.project = getSelectedOption(controls.getProjectId(row));
    if (taskInfo.project == undefined) {
        console.log("Project missing for row ", row);

        return taskInfo;
    }

    taskInfo.task = getSelectedOption(controls.getTaskId(row));
    taskInfo.timeType = getSelectedOption(controls.getTimeTypeId(row));

    return taskInfo;
}

function setTaskInfoInTimesheet(row, project, alternateProject, task, alternateTask, timeType) {
    let selectOption = function (selectId, selectValue) {
        let result = { matched: false, present: false, success: false };
        let selectCtrl = document.getElementById(selectId);
        if (selectCtrl) {
            result.present = true;

            // let xpath = "//option[contains(text(), '" + selectValue + "')]";
            // let matchingElement = document.evaluate(xpath, selectCtrl, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            let matchingElement = selectOptionForControl(selectCtrl, selectValue);

            if (matchingElement) {
                matchingElement.selected = true;
                result.matched = true;
                console.log("Here is the option found => ", selectId, selectValue, matchingElement.textContent, matchingElement.value);
                if ("createEvent" in document) {
                    var evt = document.createEvent("HTMLEvents");
                    if (evt) {
                        evt.initEvent("change", true, false);
                        result.success = selectCtrl.dispatchEvent(evt);
                    }
                } else if ("fireEvent" in selectCtrl) {
                    result.success = selectCtrl.fireEvent("onchange");
                } else {
                    console.log("Not sure how to call change on this select => ", selectId, selectValue);
                }
            } else {
                console.log("Could not find specific option for control => ", selectId, selectValue);
            }
        } else {
            console.log("Could not find control => ", selectId);
        }

        return result;
    };

    console.log("Setting project and task on row => ", project, task, row);

    // Set the Project
    let projectResult;
    if (alternateProject) {
        projectResult = selectOption(controls.getProjectId(row), alternateProject);
        if (!projectResult.success) {
            projectResult = selectOption(controls.getProjectId(row), project);
            if (!projectResult.success) {
                setError("Unable to set project on row " + row + " for " + project);
            }
        }
    } else if (project) {
        projectResult = selectOption(controls.getProjectId(row), project);
        if (!projectResult.success) {
            setError("Unable to set project on row " + row + " for " + project);
        }
    } else {
        setError("Project missing for row ", row);

        return;
    }

    // Set the Task
    if (projectResult.success) {
        if (task) {
            if (!selectOption(controls.getTaskId(row), task).success) {
                if (alternateTask) {
                    if (!selectOption(controls.getTaskId(row), alternateTask).success) {
                        setError("Unable to set task on row " + row + " for " + alternateTask);
                    }
                } else {
                    setError("Unable to set task on row " + row + " for " + task);
                }
            }
        } else {
            setError("Task misssing for row ", row);

            return;
        }
    }

    // Set the Time Type:  time type is optional, so do not present an error
    let timeTypeResult = selectOption(controls.getTimeTypeId(row), timeType);
    if (!timeTypeResult.success) {
        if (timeTypeResult.present && timeTypeResult.matched) {
            setError("Unable to set time type on row ", row);
        }
    }
}

// This is in support of the original project names from the first export
function mapProject(project) {
    if (project === "Advanced Solutions") {
        return "R&D - Advanced Solutions";
    } else if (project === "Oracle Cloud") {
        return "R&D - RFS for Oracle Cloud"
    } else {
        return undefined;
    }
}

// This is in support of the original task names from the first export
function stripTask(strippedTask) {
    let taskParts = strippedTask.split(" - ");

    if (taskParts.length === 1) {
        return undefined;
    } else {
        taskParts.shift();

        return taskParts.join(" - ");
    }
}

function addHours(row, day, hours, description) {
    let hoursAdded = false;
    let dateColumn = day.dayOfWeek + day.columnOffset;

    let setDescription = function () {
        let descSet = false;

        // Pop the modal
        let noteCtrl = controls.getNotes(row, dateColumn);
        if (noteCtrl) {
            noteCtrl.click();
            // Set the description
            let notesInput = undefined;

            if (description.field === descriptionFieldEnum.none) {
                descSet = true;
            } else {
                if ((description.field === descriptionFieldEnum.description) || (description.field === descriptionFieldEnum.both)) {
                    notesInput = controls.getNotesDescription();
                    if (notesInput) {
                        notesInput.value = description.value;
                        descSet = true;
                    }
                }
    
                if (!notesInput /* Set notes if description was not found */ || (description.field === descriptionFieldEnum.notes) || (description.field === descriptionFieldEnum.both)) {
                    notesInput = controls.getNotesNotes();
                    if (notesInput) {
                        notesInput.value = description.value;
                        descSet = true;
                    }
                }
            }

            // Click the OK button
            let okBtn = controls.getNotesOkButton();
            if (okBtn) {
                okBtn.click();
            }
        }
        
        if (!descSet) {
            setError("Unable to set the description for (row, dayOfWeek, dayOfMonth, hours, description) => ", row, day.dayOfWeek, day.dayOfMonth, hours, description.value);
        }
    };

    let dateHeaderCtrl = controls.getMonthDayHourHeader(8 - day.dayOfWeek);
    if ((day.dayOfMonth == undefined) || (dateHeaderCtrl.textContent == day.dayOfMonth)) {
        let hoursCtrl = controls.getHours(row, dateColumn);
        if (hoursCtrl) {
            hoursCtrl.value = hours;
            if ("createEvent" in document) {
                var evt = document.createEvent("HTMLEvents");
                if (evt) {
                    evt.initEvent("change", true, false);
                    if (hoursCtrl.dispatchEvent(evt)) {
                        hoursAdded = true;
                        setDescription();
                    }
                }
            } else if ("fireEvent" in hoursCtrl) {
                hoursCtrl.fireEvent("onchange");
                hoursAdded = true;
                setDescription();
            }
        } else {
            console.log("Unable to find hours control");
        }
    } else {
        console.log("Day of month and Date column do not match => ", day.dayOfMonth, dateColumn)
    }
    
    if (!hoursAdded) {
        setError("Unable to add hours for (row, dayOfWeek, dayOfMonth, hours, description) => ", row, day.dayOfWeek, day.dayOfMonth, hours, description.value)
    }
}

// This is to reduce the size of the project to make it easier to go through
function stripProjectForImport(project) {
    let projectParts = project.split(" : ", 2);

    return (projectParts.length === 2) ? projectParts[1] : project;
}

// This is to reduce the size of the task to make it easier to go through
function stripTaskForImport(task) {
    let taskParts = task.split(": ", 2);

    return (taskParts.length === 2) ? taskParts[1] : task;
}

function getProjects() {
    let timeEntriesLength = getNumberOfTimeEntries();
    let projects = [];

    for (let i = 1; i <= timeEntriesLength; i++) {
        let projectCtrl = controls.getProject(i);
        if (projectCtrl) {
            if (projectCtrl.selectedOptions && (projectCtrl.selectedOptions.length > 0) && (projectCtrl.selectedOptions[0].innerText.length > 0)) {
                let project = stripProjectForImport(projectCtrl.selectedOptions[0].innerText);
                let doesProjectExist = false;

                for (let j = 0; j < projects.length; j++) {
                    if (projects[j].name === project) {
                        doesProjectExist = true;
                        break;
                    }
                }

                if (!doesProjectExist) {
                    let taskCtrl = controls.getTask(i);
                    if (taskCtrl) {
                        let tasks = [];
                        for (let k = 1; k < taskCtrl.options.length; k++) {
                            tasks.push({ name: stripTaskForImport(taskCtrl.options[k].innerText) });
                        }

                        let selectedTask = (taskCtrl.selectedOptions.length > 0) ? taskCtrl.selectedOptions[0].innerText : undefined;
                        if (selectedTask) {
                            let billableTypeCtrl = controls.getTimeType(i);
                            if (billableTypeCtrl) {
                                let selectedBillableType = (billableTypeCtrl.selectedOptions.length > 0) ? billableTypeCtrl.selectedOptions[0].innerText : undefined;
                                if (selectedBillableType === "Billable Time") {
                                    tasks.push({ name: selectedTask + " [Billable]" });
                                } else {
                                    console.log("Unable to find selected billable type => " + i);
                                }
                            } else {
                                console.log("Unable to find billable type control => " + i);
                            }
                        } else {
                            console.log("Unable to find selected task => " + i);
                        }

                        projects.push({ name: project, tasks: tasks });
                    } else {
                        console.log("Unable to find task control => " + i);
                    }
                }
            } else {
                console.log("Project control does not have a selected option => " + i);
            }
        } else {
            console.log("Could not find project control => " + i);
        }
    }

    return projects;
}