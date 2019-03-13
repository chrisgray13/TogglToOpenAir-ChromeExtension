// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onInstalled.addListener(function () {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [new chrome.declarativeContent.PageStateMatcher({
                pageUrl: {
                    urlMatches: 'https://www.openair.com/timesheet.pl',
                    queryContains: 'timesheet_id',
                    urlContains: 'action=grid'
                },
            })
            ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
        }]);
    });
});

chrome.webNavigation.onCompleted.addListener(function (details) {
    // Using setTimeout to give OpenAir a couple of seconds to truly finish loading the DOM
    setTimeout(function () {
        chrome.tabs.sendMessage(details.tabId, {
            action: "getStartDate"
        }, function (response) {
            let startDate = "";
            if (response) {
                startDate = response.success ? (response.startDate || "") : "";
            }
            chrome.storage.local.set({
                startDate: startDate
            });
        });
    }, 2000);
}, {
    url: [{
        urlMatches: 'https://www.openair.com/timesheet.pl',
        queryContains: 'timesheet_id',
        urlContains: 'action=grid'
    }]
});