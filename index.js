/* ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

// SDK
var simplePrefs = require("sdk/simple-prefs");
var preferences = simplePrefs.prefs;
var preferencesService = require("sdk/preferences/service");
var windows = require("sdk/windows");
var windowUtils = require("sdk/window/utils");
var hotkey = require("sdk/hotkeys").Hotkey;
var { viewFor } = require("sdk/view/core");
var { Services }  = require("resource://gre/modules/Services.jsm");

// Modules
var { unload } = require("./lib/utils.js");
var { VerticalTabsReloaded } = require("./lib/verticaltabs.js");

let packageJSON = require("./package.json");
const PREF_BRANCH = "extensions."+packageJSON['preferences-branch']+".";

// Reset the preferences
function setDefaultPrefs() 
{
	for (let aPreference of preferencesService.keys(PREF_BRANCH))
	{
		preferencesService.reset(aPreference);
	}
}

var GLOBAL_SCOPE = this;
function initHotkeys() {
	var objectScope = GLOBAL_SCOPE;
	let toggleKey = preferences["toggleDisplayHotkey"];
	let windowUtilsx = windowUtils;
	GLOBAL_SCOPE.vtToggleDisplayHotkey = hotkey({
		combo: toggleKey,
		onPress: function() {
			let windowID = windowUtilsx.getOuterId(windowUtilsx.getToplevelWindow(windowUtilsx.getFocusedWindow()));
			objectScope["vt"+windowID].toggleDisplayState();
		}
	});
	
	unload(function() {
		GLOBAL_SCOPE.vtToggleDisplayHotkey.destroy();
	});
}
	
exports.main = function (options, callbacks) {
    if (options.loadReason == "install") {
		preferencesService.set("browser.tabs.drawInTitlebar", false);
	}
	else if (options.loadReason == "upgrade") {
		// v0.4.0 -> v0.5.0, remove when most use >= v0.5.0 
		if(preferences["theme"] == "winnt") {
			preferences["theme"] = "windows";
		}
		
		// v0.4.0 -> v0.5.0, remove with the next version
		preferencesService.set("browser.tabs.drawInTitlebar", false);
    }
	
	// Back up 'browser.tabs.animate' pref before overwriting it
	let animate = preferencesService.get("browser.tabs.animate");
	preferences["animate"] = animate;
	preferencesService.set("browser.tabs.animate", false);
	
	unload(function () {
		let animate = preferences["animate"];
		preferencesService.set("browser.tabs.animate", animate);
	});

	// Initialize VerticalTabsReloaded object for each window.
	
	for (let window of windows.browserWindows) {
		let lowLevelWindow = viewFor(window);
		let windowID = windowUtils.getOuterId(lowLevelWindow);
		GLOBAL_SCOPE["vt"+windowID] = new VerticalTabsReloaded(lowLevelWindow);
		//unload(vt.installStylesheet("chrome://browser/content/tabbrowser.css"));
		unload(GLOBAL_SCOPE["vt" + windowID].unload.bind(GLOBAL_SCOPE["vt"+windowID]), lowLevelWindow);
	}

	windows.browserWindows.on('open', function(window) {
		let lowLevelWindow = viewFor(window);
		let windowID = windowUtils.getOuterId(lowLevelWindow);
		GLOBAL_SCOPE["vt"+windowID] = new VerticalTabsReloaded(lowLevelWindow);
		unload(GLOBAL_SCOPE["vt"+windowID].unload.bind(GLOBAL_SCOPE["vt"+windowID]), lowLevelWindow);
	});

	windows.browserWindows.on('close', function(window) {
		let lowLevelWindow = viewFor(window);
		let windowID = windowUtils.getOuterId(lowLevelWindow);
		GLOBAL_SCOPE["vt"+windowID].unload();
		delete GLOBAL_SCOPE["vt"+windowID];
	});

	initHotkeys();
	
	simplePrefs.on("toggleDisplayHotkey", function(prefName) { GLOBAL_SCOPE.vtToggleDisplayHotkey.destroy(); initHotkeys(); });
	
};

exports.onUnload = function (reason) {
	console.log("onUnload:" + reason);
	if(reason == "disable")
    {
        console.log("VTR disabled");
    }  
	
	unload();
	
    if (reason == "uninstall") {
        // Unloaders might want access to prefs, so do this last
        // Delete all settings
		console.log("VTR uninstall");
        Services.prefs.getDefaultBranch(PREF_BRANCH).deleteBranch("");
    }
}
