/* Author: Javier Egido Alonso || Sizmek Spain */
window.ebO && ebO.extensionHooks && ebO.extensionHooks.push(function (adConfig) {
	"use strict";

	//=================================================
	// Variables
	//-------------------------------------------------

	//change "CustomFormat" to the name of your ad format in the scriptName variable AND DELETE THIS COMMENT !!!
	var scriptName = "PL_AdPulse";
	var scriptVersion = "0.0.1"; //you'll increase this by 0.0.1 each version until released, when it becomes 1.0.0
	var lastModified = "2018-06-15";
	var lastUploaded = "2018-06-15"; //this might be different to modified if it was uploaded 3 days later for example

	var templateVersion = "2.0.24"; //template version on which this custom script is based
	var isDebug = true; //For enabling/disabling the _self.log function (Set this to false on release)
	var progFormatID = 0; // change this to the ID of your format in the programmatic tool

	var adId = adConfig.adId; //we can't use API yet because EBG.ads is not populated yet
	var rnd = adConfig.rnd; //so none of the functions that take a uid as first parameter will work
	var uid = adConfig.uid; //including the one that gets or sets adConfig values
	var _self; //our custom object with our functions and properties (not the same as ad)
	var ad; //the ad object that we no longer extend
	var os;
	var browser;
	var adFilter = {
		myAd: uid
	};

	EBG.customFormats = EBG.customFormats || {};
	EBG.customFormats[uid] = EBG.customFormats[uid] || {};

	try {
		if(parent.EBG) {
			parent.EBG.customFormats = parent.EBG.customFormats || {};
			parent.EBG.customFormats[uid] = EBG.customFormats[uid];
		}
	}
	catch(e) {}
	//-------------------------------------------------

	var adSelf = null;

	var MyAd = function (adConfig) {
		EBG.callSuperConstructor(MyAd, this, [adConfig]);
	};

	MyAd.prototype = {
		_show: function () {
			adSelf = this;

			var shex = EBG.API.Ad.getAdData(uid, "uponShow") > 1 && EBG.API.Ad.shouldExpand(uid);

			_self.defaultCustomFormatVars = {

				//auto generated vars, not coming from platform

				mdIsAutoExpand: shex,
				mdWasAutoExpand: shex,
				mdAdBuilder: !!EBG.API.Ad.getAdData(uid, "adBuilder"),

				//vars that optionally come from the platform but are given defaults in case they're not set in the platform

				mdParentLevelsToResize: 0, //(if we see it's not 0 then we know it was set from platform and it triggers the code
				mdBackupImgPath: undefined, //e.g. "someassetpath" (if we see it's still undefined then we know it wasn't set from platform)
				mdAutoRepositionInterval: 0,
				mdIsDomainConfigEnabled: false,
				mdProgSettingsFolderPath: "//services.serving-sys.com/programmatic/DomainList/",
				mdEyeDivZIndex: undefined, //on the platform this should be type "String"
				mdAutoCollapseTimer: 0, //on the platform this should be type "Integer"
				mdInteractionsCancelAutoCollapse: false
			};

			_self.initCustomVarDefaults();

			//if custom vars testing function exists, call it now giving it the uid and _self
			if(window["ebCSOverride_" + adConfig.adId])
				window["ebCSOverride_" + adConfig.adId](uid, _self);

			var repos = parseInt(_self.mdAutoRepositionInterval, 10);
			if(!isNaN(repos) && repos > 0) {
				EBG.API.Ad.setAdData(uid, {
					locationPolling: EBG.Initializer._setLocationPolling(repos), //force repos to between 10 and 100
					forceLocationPolling: true //ensure client doesn't use mutationobserver
				});
			}

			var progMan = new _self.ProgrammaticManager(function (result) {
				// result is a key value object; key is file url and value is the call response.
				// we handle the result directly in our Programmatic Manager, however, so result is unused here

				//if custom vars testing function for after programmatic exists, call it now giving it the uid and _self
				if(window["ebCSOverrideAP_" + adConfig.adId])
					window["ebCSOverrideAP_" + adConfig.adId](uid, _self);
				if(_self.isDebug) {
					_self.log("Custom Var Values after programmatic logic");
					for(var cusvar in adConfig.customJSVars) {
						if(adConfig.customJSVars.hasOwnProperty(cusvar)) {
							_self.log("[" + cusvar + "] == [" + adConfig.customJSVars[cusvar] + "]");
						}
					}
				}

				EBG.callSuperFunction(MyAd, adSelf, "_show", [adConfig]);
			});
		}
	};
 
	var eventSub = new EBG.Events.EventSubscription(EBG.Events.EventNames.CREATE_AD,
		function (event) {
			EBG.declareClass(MyAd, event.eventData.currentClass);
			event.eventData.currentClass = MyAd;
		});
	eventSub.timing = EBG.Events.EventTiming.BEFORE;
	eventSub.dispatcherFilters = {
		"_adConfig.rnd": rnd
	};
	EBG.eventMgr.subscribeToEvent(eventSub);

	//=================================================
	// Constructor
	//-------------------------------------------------
	/**
	 * Creates the CustomFormat object.
	 *
	 * @constructor
	 * @this {CustomFormat}
	 */
	function CustomFormat() {
		_self = this; //use _self instead of this for guaranteed reference to this object and not window (on event handlers)

		EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.SHOW_AD, _self.handlers.handleBeforeShowAd, EBG.Events.EventTiming.BEFORE, adFilter);

		// How to unsubscribe:
		// EBG.API.EventManager.unsubscribeFromEvent(EBG.Events.EventNames.SHOW_AD,_self.handlers.handleBeforeShowAd,EBG.Events.EventTiming.BEFORE,adFilter);
	}
	//-------------------------------------------------

	//-------------------------------------------------------------------------------------------------------------------------------------------------------
	//=================================================
	// Public methods/functions/properties
	//-------------------------------------------------
	CustomFormat.prototype = {
		isDebug: isDebug, //this is only here so it can be overridden by a custom script plugin

		//put your constants here

		defaultCustomFormatVars: undefined,
		isPolite: undefined,
		wasPolite: undefined,
		repositionInterval: undefined,
		displayWin: undefined,
		pageWin: undefined,
		subs: undefined,
		ebDiv: undefined,
		panels: undefined,
		defaultPanel: undefined,
		defaultPanelName: undefined,
		iframe: undefined,
		bannerDiv: undefined,
		subscribedRSO: undefined,
		CCs: undefined,
		curScrollPos: {},
		banner1x1: undefined,
		capturedEyeDiv: null,
		isBannerReady: false,

		pm: null,
		stylesheetOnExpand: {}, // stores the different expand panel stylesheets for removal at a later time
		stylesheetOnCollapse: {}, // stores the different collapse panel stylesheets for removal at a later time
		stylesheetOnLoad: undefined,
		//if you want to override an event handler, overwrite its entry in the handlers object to point to your function
		//=================================================
		// Event Handlers
		//-------------------------------------------------
		handlers: {
			// In the event of having more than 1 subscription for a specific event/timing pair, just number each one (including the first, e.g.: SHOW_AD_BEFORE1)
			handleBeforeShowAd: function () {
				return _self._handleBeforeShowAd.apply(this, arguments);
			},
			handleAfterShowAd: function () {
				return _self._handleAfterShowAd.apply(this, arguments);
			},
			handleCounterInteraction: function () {
				return _self._handleCounterInteraction.apply(this, arguments);
			},
			handlePreExpand: function () {
				return _self._handlePreExpand.apply(this, arguments);
			},
			handleBeforeExpand: function () {
				return _self._handleBeforeExpand.apply(this, arguments);
			},
			handleAfterExpand: function () {
				return _self._handleAfterExpand.apply(this, arguments);
			},
			handleBeforeCollapse: function () {
				return _self._handleBeforeCollapse.apply(this, arguments);
			},
			handleBeforeAddCreatives: function () {
				return _self._handleBeforeAddCreatives.apply(this, arguments);
			},
			handleAfterAddCreatives: function () {
				return _self._handleAfterAddCreatives.apply(this, arguments);
			},
			handleOntimePageResize: function () {
				return _self._handleOntimePageResize.apply(this, arguments);
			},
			handleOntimePageScroll: function () {
				return _self._handleOntimePageScroll.apply(this, arguments);
			},
			handleOntimeOrientation: function () {
				return _self._handleOntimeOrientation.apply(this, arguments);
			},
			handleCreativeContainerReady: function () {
				return _self._handleCreativeContainerReady.apply(this, arguments);
			},
			handleAfterCollapse: function () {
				return _self._handleAfterCollapse.apply(this, arguments);
			},
			handleBeforeAdUnload: function () {
				return _self._handleBeforeAdUnload.apply(this, arguments);
			},

			handleMessageReceived: function () {
				return _self._handleMessageReceived.apply(this, arguments);
			} //no comma
		},

		_handleBeforeShowAd: function (event) {
			_self.log("_handleBeforeShowAd: isDefaultImage=" + event.eventData.isDefaultImage + ", dlm=" + EBG.API.Ad.getAdData(uid, "dlm") + ", uponShow=" + EBG.API.Ad.getAdData(uid, "uponShow")); //add ,event if you want to see all properties traced
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.SHOW_AD, _self.handlers.handleAfterShowAd, EBG.Events.EventTiming.AFTER, adFilter);

			if(event.eventData.isDefaultImage) return; // don't do anything else if we're just serving a default image

			ad = event.dispatcher;
			os = EBG.API.os;
			browser = EBG.API.browser;

			_self.isPolite = _self.wasPolite = EBG.API.Ad.getAdData(uid, "dlm") === 1;

			_self.repositionInterval = undefined;
			_self.displayWin = EBG.API.Adaptor.getDisplayWin();
			_self.pageWin = EBG.API.Adaptor.getPageWin();
			_self.displayWin.gEbPIT = _self.displayWin.gEbPIT || {};
			_self.subs = _self.displayWin.gEbPIT.subscriptions = _self.displayWin.gEbPIT.subscriptions || {};

			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.ADD_CREATIVES, _self.handlers.handleBeforeAddCreatives, EBG.Events.EventTiming.BEFORE, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.ADD_CREATIVES, _self.handlers.handleAfterAddCreatives, EBG.Events.EventTiming.AFTER, adFilter);

			//Subscribe to the expand event that is handled by the client's _handleExpand function. This isn't the expand event we usually
			//subscribe to. We're doing this so that we can modify properties of the eventData before _handleExpand is called.
			EBG.API.EventManager.subscribeToEvent(EBG.EBMessage.EXPAND, _self.handlers.handlePreExpand, EBG.Events.EventTiming.BEFORE, adFilter);
			if(_self.mdInteractionsCancelAutoCollapse) {
				EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.HANDLE_COUNTER_INTERACTION, _self.handlers.handleCounterInteraction, EBG.Events.EventTiming.BEFORE);
			}

			//Subscribe to the CC's EXPAND event also
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.EXPAND, _self.handlers.handleBeforeExpand, EBG.Events.EventTiming.BEFORE, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.EXPAND, _self.handlers.handleAfterExpand, EBG.Events.EventTiming.AFTER, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.COLLAPSE, _self.handlers.handleBeforeCollapse, EBG.Events.EventTiming.BEFORE, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.CREATIVE_CONTAINER_READY, _self.handlers.handleCreativeContainerReady, EBG.Events.EventTiming.ONTIME, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.COLLAPSE, _self.handlers.handleAfterCollapse, EBG.Events.EventTiming.AFTER, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.AD_UNLOAD, _self.handlers.handleBeforeAdUnload, EBG.Events.EventTiming.BEFORE);

			_self.addWindowListener("message", "handleMessageReceived", _self.handlers["handleMessageReceived"]);

			//special safeframe handling for messages due to 'fake' pm messages
			if(EBG.adaptor.isSafeFrame()) {
				//this will subscribe to messages that are safeframe compatible
				for(var key in _self.messageHandlers) {
					if(!_self.messageHandlers.hasOwnProperty(key)) {continue;}

					//this line is for safeframe compatible pm message handling
					EBG.pm.bind(key, _self.handlers["handleMessageReceived"], _self, _self.displayWin); //note: json will arrive in 'params', not 'event'
				}
			}

			_self.ebDiv = EBG.API.Ad.getPlaceholder(uid);
			_self.panels = EBG.API.Ad.getAdData(uid, "panels");
			if(_self.panels) {
				for(var pan in _self.panels) {
					if(_self.panels.hasOwnProperty(pan)) {
						_self.defaultPanelName = pan;
						break;
					}
				}
			}

			if(!_self.isPolite) {
				_self._subscribeToResizeScrollOrientation("_handleBeforeShowAd:not polite");
			}


			

			// _self.loadExternalJSON(function(response){
			// 	var responseJSON = JSON.parse(response);
			// 	var currentDomain = window.location.hostname;

			// 	for (var i in responseJSON) {
			// 		if (currentDomain == responseJSON[i]["pubDomain"]) {
			// 			_self.publisherSetup = responseJSON[i]["pubFix"];
			// 		}
			// 	}
			// 	_self.addStylesheetToHead(_self.publisherSetup);
				
			// },"https://services.serving-sys.com/custprojassets/prd/features/feeds/1767/VB_PublishersSetup.json");

		},

		_handleAfterShowAd: function (event) {
			_self.log("_handleAfterShowAd: isDefaultImage=" + event.eventData.isDefaultImage + ", dlm=" + EBG.API.Ad.getAdData(uid, "dlm") + ", uponShow=" + EBG.API.Ad.getAdData(uid, "uponShow")); //add ,event if you want to see all properties traced

			if(event.eventData.isDefaultImage && _self.mdBackupImgPath !== undefined) {
				_self.showFullSizedBackupImage(); //show full sized backup image and return
				return;
			}

			if(!_self.wasPolite) {
				_self.iframe = EBG.API.Banner.getElements(uid).banner;
				_self.bannerDiv = EBG.API.Banner.getElements(uid).bannerDiv;

				_self._onloadInjectCSSandJS(event); //if we aren't a polite load, now is the onload time to call this
			}
		},

		_onloadInjectCSSandJS: function (event) {
			// Execute JS and inject CSS if any was used in Programmatic Settings
			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoad")) {
				_self.stylesheetOnLoad = _self.addStylesheetToHead(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoad"), event.dispatcher));
				_self.log("Injecting CSS on load; removing on unload? " + EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoadRemoveOnUnload"), EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoad"));
			}
			if(EBG.API.Ad.getCustomVar(uid, "_mdJsOnLoad")) {
				_self.execJS(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdJsOnLoad"), event.dispatcher));
				_self.log("Executing JS on load", EBG.API.Ad.getCustomVar(uid, "_mdJsOnLoad"));
			}
		},

		_handleCounterInteraction: function (event) {

			//Currently we could use this var to decide whether to even subscribe to this event, but that's only true for cancelling the
			//collapse timer. In future we might do other things here.
			//this block of code is looking for an event that indicates this is a user interaction (but not if it's "default")
			//and then using that to cancel any active auto collapse
			var eD = event.eventData;
			if(eD) {
				var i = eD.interaction;
				if(i) {
					var id = i.interactionData;
					if(id) {
						var iT = id.initiationType;
						var rN = id.reportingName;
						if(iT && rN && iT === "user" && rN !== "default" && rN !== EBG.API.Ad.getAdData(uid, "defaultPanelName")) {
							_self.log("Cancelling Collapse timer");
							EBG.API.Panel.cancelCollapseTimer(uid);
						}
					}
				}
			}
		},

		_handlePreExpand: function (event) {

			//Handle auto collapse timer. The default/template behaviour is that the timer is only used for the auto-collapsing the default panel.
			//Change the logic if you want to also auto collapse other panels.
			//If you want to override expansion behaviour (to "Get in before the expand") then you can do it here, modifying the eventData before the _handleExpand is called

			var aCT = parseInt(_self.mdAutoCollapseTimer);
			if(event && aCT > 0) {
				var eD = event.eventData;
				var dis = event.dispatcher;

				var panelName = (eD && eD.panelName) ? eD.panelName : (dis && dis.panelName) ? dis.panelName : null;

				//if we have a panel name, and a default panel name, and the two are the same, then we add the auto collapse timer to this expand
				if(panelName && panelName.toLowerCase() === _self.defaultPanelName.toLowerCase()) {

					if(!eD) event.eventData = {};
					event.eventData.autoCollapse = aCT;
					_self.log("_handlePreExpand: setting autoCollapseTimer on default panel to " + aCT);
				}
			}
		},

		_handleBeforeExpand: function (event) {
			_self.log("_handleBeforeExpand: panelName=" + event.dispatcher.panelName); //add ,event if you want to see all properties traced

			//if we have a zIndex we want to use and no panel is expanded yet capture the eyeDiv value
			if(_self.mdEyeDivZIndex !== undefined) {
				var eyeDiv = EBG.API.Adaptor.getEyeDiv();
				var eyeDivZ = EBG.API.Adaptor.getStyle(eyeDiv, "zIndex");
				//if we haven't yet saved the original eyeDiv value, save it now
				if(_self.capturedEyeDiv === null) {
					_self.capturedEyeDiv = eyeDivZ;
				}
				//if the eyeDiv zIndex isn't currently what we want it to be then update it now
				if(eyeDivZ !== _self.mdEyeDivZIndex) {
					EBG.API.Adaptor.setStyle(eyeDiv, {
						zIndex: _self.mdEyeDivZIndex
					});
				}
			}

			// Execute JS and inject CSS if any was used in Programmatic Settings
			var isDefaultPanelExpanding = event.dispatcher.panelName.toLowerCase() === _self.defaultPanelName.toLowerCase();

			// check the settings in the programmatic settings admin tool
			// Use these to determine if we actually need to inject css for this panel expansion
			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpand")) {
				var injectOnAnyPanel = [7, 8, 9, 10, 11, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0;
				var injectFirstPanelOnly = [4, 5, 6, 10, 11, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0;
				if((injectOnAnyPanel || isDefaultPanelExpanding) && (!injectFirstPanelOnly || !EBG.API.Ad.isExpanded(uid))) {
					_self.stylesheetOnExpand[event.dispatcher.panelName.toLowerCase()] = _self.addStylesheetToHead(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpand"), event.dispatcher));
				}
			}

			// check the settings in the programmatic settings admin tool
			// Use these to determine if we actually need to execute for this panel expansion
			if(EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpand")) {
				var execOnAnyPanel = (EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpandType") === 3 || EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpandType") === 4);
				var execFirstPanelOnly = (EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpandType") === 2 || EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpandType") === 4);
				if((execOnAnyPanel || isDefaultPanelExpanding) && (!execFirstPanelOnly || (!EBG.API.Ad.isExpanded(uid)))) {
					_self.execJS(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelExpand"), event.dispatcher));
				}
			}

			if (event.dispatcher.panelName === "billboard") {
				var referenceDiv = _self.displayWin.document.querySelector("body");
				var auxElement = document.createElement("div");
				auxElement.id = "pushDiv";

				_self.displayWin.document.body.insertBefore(auxElement,_self.displayWin.document.body.firstChild);

				_self.pushDiv = _self.displayWin.document.getElementById("pushDiv");

				EBG.API.Adaptor.setStyle(_self.pushDiv, {
					position: "relative",
					margin: "0 auto",
					width: "970px",
					height: _self.marginTop || "270px",
					webkitTransition: "height 0.3s ease-out",
					transition: "height 0.3s ease-out;"
				});

				var customBillboardStyle = '#'+event.dispatcher.props.panel.id+'{top:10px!important;}';
				// customBillboardStyle += '#contenedor,#td-outer-wrap{position:relative;z-index:2;}';
				customBillboardStyle += 'body > div {position:relative;z-index:2;}';
				_self.addStylesheetToHead(customBillboardStyle);

			}
			if (event.dispatcher.panelName === "skin") {
				var referenceDiv = _self.displayWin.document.querySelector("body");
            	_self.moveElement(referenceDiv, _self.displayWin.document.getElementById(event.dispatcher.props.panel.id), 'first');
            	_self.panelDiv.style.setProperty("z-index", "1");
			}
			
		},

		_handleAfterExpand: function (event) {
			_self.log("_handleAfterExpand: panelName=" + event.dispatcher.panelName); //add ,event if you want to see all properties traced
			// _self.panelDiv = _self.displayWin.document.getElementById(event.dispatcher.props.panel.id);
			// _self.panelFrm = _self.displayWin.document.getElementById(event.dispatcher.iframeId);
			// _self.panelId = event.dispatcher.props.panel.id;


			// EBG.API.Adaptor.setStyle(_self.panelFrm, {
			// 	position: "fixed",
			// 	top:EBG.px(0),
			// 	left: EBG.px(0),
			// 	width: EBG.px(windowSize.width),
			// 	height: EBG.px(windowSize.height),
			// 	fontSize: "0px",
			// 	whiteSpace: "nowrap",
			// 	visibility: "visible"
			// });
			// EBG.API.Adaptor.setStyle(_self.panelDiv, {
			// 	position: "fixed",
			// 	top:EBG.px(0),
			// 	left: EBG.px(0),
			// 	width: EBG.px(windowSize.width),
			// 	height: EBG.px(windowSize.height),
			// 	fontSize: "0px",
			// 	whiteSpace: "nowrap",
			// 	visibility: "visible"
			// });

		},

		_handleBeforeCollapse: function (event) {
			_self.log("_handleBeforeCollapse: panelName=" + event.dispatcher.panelName); //add ,event if you want to see all properties traced
			_self.setDefault("mdIsAutoExpand", false, true);
		},

		_handleAfterCollapse: function (event) {
			_self.log("_handleAfterCollapse: panelName=" + event.dispatcher.panelName); //add ,event if you want to see all properties traced

			//if we have a zIndex we used and all panels are now collapsed and we have a captured value we want to restore
			if(_self.mdEyeDivZIndex !== undefined && !EBG.API.Ad.isExpanded(uid) && _self.capturedEyeDiv !== null) {
				var eyeDiv = EBG.API.Adaptor.getEyeDiv();
				//if we still have an eyeDiv (because it hasn't been removed) then restore the zIndex to what it was
				if(eyeDiv) {
					EBG.API.Adaptor.setStyle(eyeDiv, {
						zIndex: _self.capturedEyeDiv
					});
				}
				//and overwrite our "captured" variable so that we can do a fresh capture on next expand
				_self.capturedEyeDiv = null;
			}

			var isDefaultPanelCollapsing = event.dispatcher.panelName.toLowerCase() === _self.defaultPanelName.toLowerCase();

			var injectOnAnyPanel;
			// check the settings in the programmatic settings admin tool
			// Use these to determine if need to remove css for this panel collapse
			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpand")) {
				injectOnAnyPanel = [7, 8, 9, 10, 11, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0;
				var removeOnCollapse = [2, 3, 5, 6, 8, 9, 11, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0;
				var removeIfLastPanel = [3, 6, 9, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0;
				if((injectOnAnyPanel || isDefaultPanelCollapsing) && (removeOnCollapse && (!removeIfLastPanel || !EBG.API.Ad.isExpanded(uid)))) {
					_self.stylesheetOnExpand[event.dispatcher.panelName.toLowerCase()].parentNode.removeChild(_self.stylesheetOnExpand[event.dispatcher.panelName.toLowerCase()]);
					delete _self.stylesheetOnExpand[event.dispatcher.panelName.toLowerCase()];
				}
			}

			// if no panels are expanded after this panel collapses, we need to traverse through all panels potentially in stylesheetOnExpand and
			// if any of them are set to have their code removed on panel collapse (when no other panels still expanded), we need
			// to remove them. There should only be a maximum of a single panel in that object
			if(!EBG.API.Ad.isExpanded(uid) && [3, 6, 9, 12].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelExpandType")) >= 0) {
				var i;
				for(i in _self.stylesheetOnExpand) {
					if(!_self.stylesheetOnExpand.hasOwnProperty(i)) {continue;}
					_self.stylesheetOnExpand[i].parentNode.removeChild(_self.stylesheetOnExpand[i]);
					delete _self.stylesheetOnExpand[i];
				}
			}

			// check the settings in the programmatic settings admin tool
			// Use these to determine if we actually need to inject css for this panel collapse
			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelCollapse")) {
				injectOnAnyPanel = [3, 4].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelCollapseType")) >= 0;
				var injectLastPanelOnly = [2, 4].indexOf(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelCollapseType")) >= 0;
				if((injectOnAnyPanel || isDefaultPanelCollapsing) && (!injectLastPanelOnly || !EBG.API.Ad.isExpanded(uid))) {
					_self.stylesheetOnCollapse[event.dispatcher.panelName.toLowerCase()] = _self.addStylesheetToHead(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdCssOnPanelCollapse"), event.dispatcher));
				}
			}

			// check the settings in the programmatic settings admin tool
			// Use these to determine if we actually need to execute js for this panel collapse
			if(EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapse")) {
				var execOnAnyPanel = (EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapseType") === 3 || EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapseType") === 4);
				var onLastPanelExpanded = (EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapseType") === 2 || EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapseType") === 4);
				if((execOnAnyPanel || isDefaultPanelCollapsing) && (!onLastPanelExpanded || (!EBG.API.Ad.isExpanded(uid)))) {
					_self.execJS(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdJsOnPanelCollapse"), event.dispatcher));
				}
			}
		},

		_handleBeforeAddCreatives: function (event) {
			_self.log("_handleBeforeAddCreatives:" + event.eventData.creativeType + ":panelName=" + (event.eventData.panelName || "banner")); //add ,event if you want to see all properties traced

			//check in event data for whether this is a banner or panel, and if a panel, which panel is it
			//you can then modify what you need to before the banner/panel are created. You can modify
			//the expand/collapse parameters here too. The ADD_CREATIVES is dispatched after the panel's
			//CC object is created with all the default parameters, but just before the HTML tags are
			//written to the page, so in addition to modify the expand/collapse params, you can also
			//modify the HTML tags that are about to be written.

			//if(event.eventData.creativeType === EBG.Events.EventNames.ADD_BANNER_PRELOAD_IMAGE_CREATIVE) {	//adding the preload img
			//}

			if(event.eventData.creativeType === EBG.Events.EventNames.ADD_HTML5_MAIN_CREATIVE) { //adding the HTML5 banner
				if(_self.isPolite) {
					_self._subscribeToResizeScrollOrientation("_handleBeforeAddCreatives:banner:was polite");
					_self.isPolite = false; //not polite anymore (note: we still have _self.wasPolite if we want to know if we 'were')
				}
			}
			else if(event.eventData.creativeType === EBG.Events.EventNames.ADD_HTML5_PANEL_CREATIVE) {
				//event.eventData.panelName is being added
				_self.defaultPanel = ad._panels[_self.defaultPanelName.toLowerCase()]; //you may want to know this before now, but default panel isn't "set" until first panel gets added
			}
		},

		_handleAfterAddCreatives: function (event) {
			_self.log("_handleAfterAddCreatives:" + event.eventData.creativeType + ":panelName=" + (event.eventData.panelName || "banner")); //add ,event if you want to see all properties traced
		},

		_subscribeToResizeScrollOrientationDisplayWindow: function () {
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.PAGE_RESIZE, _self.handlers.handleOntimePageResize, EBG.Events.EventTiming.ONTIME, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.PAGE_SCROLL, _self.handlers.handleOntimePageScroll, EBG.Events.EventTiming.ONTIME, adFilter);
			EBG.API.EventManager.subscribeToEvent(EBG.Events.EventNames.SCREEN_ORIENTATION, _self.handlers.handleOntimeOrientation, EBG.Events.EventTiming.ONTIME);
		},

		_subscribeToResizeScrollOrientation: function (trig) {
			if(!_self.subscribedRSO) { //time to subscribe to Resize/Scroll/Orientation events, as long as we didn't already do that
				if(window !== _self.pm.topWin) {
					try {
						EBG.API.EventManager.subscribeToElementEvent(_self.pm.topWin.document.body, "scroll", _self.handlers.handleOntimePageScroll, EBG.Events.EventTiming.ONTIME);
					}
					catch(e) {}
				}
				_self._subscribeToResizeScrollOrientationDisplayWindow();
				_self.subscribedRSO = true;
				_self.log("_subscribeToResizeScrollOrientation:triggered by " + trig);
			}
		},

		_handleMessageReceived: function (event, params) {
			try {
				var msg = typeof event == "object" && event.data ? JSON.parse(event.data) :
					typeof params == "object" && params.data && typeof params.data == "string" ? JSON.parse(params.data) :
					typeof params == "object" && params.data && params.data.uid ? params : {};

				//only messages with matching uid are handled.
				//Don't change this code to match what your assets send, change your
				//assets to match this (you NEED to send uid for multiple ads on a page).
				if(msg.type && msg.data && msg.data.uid && msg.data.uid === uid && _self.messageHandlers.hasOwnProperty(msg.type)) {
					_self.log("_handleMessageReceived:" + msg.type, msg);
					_self.messageHandlers[msg.type](msg);
				}
			}
			catch(e) {
				_self.log("_handleMessageReceived:catch", e);
			}
		},

		messageHandlers: {

			//note: these function names are also the "message" names. so when you dispatch a "setCreativeVersion" message from
			//		inside a creative, if you got the case wrong, then it would fail because no such function would exist. It's
			//		the main reason our messages aren't all upper case, because the function definitions would look horrible.

			addCustomScriptEventListener: function (msg) {
				_self.subs[msg.data.listenerId] = msg.data;
			},

			dispatchCustomScriptEvent: function (msg) {
				for(var i in _self.subs) {
					if(!_self.subs[i]) {continue;}
					var isEventMatch = _self.subs[i].eventName === msg.data.eventName;
					var isCurrentAd = msg.data.uid === _self.subs[i].uid;
					var isOutOfAdScope = !isCurrentAd && !msg.data.interAd;
					if(!isEventMatch || isOutOfAdScope) {continue;}
					if(_self.subs[i].callback) {
						try {
							_self.subs[i].callback(msg.data);
						}
						catch(e) {
							delete _self.subs[i]; //delete 'lost' listener
						}
					}
					else {
						var listenerIds = [];
						listenerIds[listenerIds.length] = _self.subs[i].listenerId;
						msg.data.listenerIds = listenerIds;
						try {
							// need to send data type as a property in msg data for safe frames
							msg.data.type = "eventCallback";
							_self.CCs[_self.subs[i].creativeIFrameId]._sendMessage("eventCallback", msg.data);
						}
						catch(e) {}
					}
				}
			},

			removeCustomScriptEventListener: function (msg) {
				delete _self.subs[msg.data.listenerId];
			},

			removeAd: function () {
				_self.removeAd();
			},

			setCreativeVersion: function (msg) {
				if(msg.data.creativeVersion) {
					_self.handleSetCreativeVersion(msg.data);
					window.setTimeout(function () {
						_self.isBannerReady = true;
						_self.dispatchScrollPos();
					}, 250);
				}
			},

			dispatchScrollPos: function () {
				_self.dispatchScrollPos(true);
			},

			setInfo: function(msg){
				_self.marginTop = msg.data.topGap;
			},
			collapseRequest: function(){
				_self.onCollapseRequested();
				_self.isExpanded = false;
			},
			expansionRequest: function(){
				_self.onExpandRequested();
				_self.isExpanded = true;
			},
			baseExpansionRequest: function(){
				try{
					_self.panelFrm.contentWindow.postMessage(JSON.stringify({type: "baseExpansion", data: {}}), "*");
				}catch(error){
					console.log("Error: ",error);
				}
			}
					
		},

		_handleOntimePageResize: function (event) {
			//do something on resize
			//_self.log("_handleOntimePageResize");
			// setTimeout(function(){
			// 	var windowSize = EBG.API.Adaptor.getViewPortMetrics();
			// 	if (_self.isExpanded === true ) {
			// 		_self.setMarginTop(windowSize.height);	
			// 	}			
			// 	EBG.API.Adaptor.setStyle(_self.panelFrm, {
			// 		position: "fixed",
			// 		top:EBG.px(0),
			// 		left: EBG.px(0),
			// 		width: EBG.px(windowSize.width),
			// 		height: EBG.px(windowSize.height),
			// 		fontSize: "0px",
			// 		whiteSpace: "nowrap",
			// 		visibility: "visible"
			// 	});
			// 	EBG.API.Adaptor.setStyle(_self.panelDiv, {
			// 		position: "fixed",
			// 		top:EBG.px(0),
			// 		left: EBG.px(0),
			// 		width: EBG.px(windowSize.width),
			// 		height: EBG.px(windowSize.height),
			// 		fontSize: "0px",
			// 		whiteSpace: "nowrap",
			// 		visibility: "visible"
			// 	});
			// }, 50);
			_self.dispatchScrollPos();
		},

		_handleOntimePageScroll: function (event) {
			//do something on scroll
			//_self.log("_handleOntimePageScroll");

			//_self.dispatchScrollPos();
		},

		_handleOntimeOrientation: function (event) {
			//do something on orientation
			_self.log("_handleOntimeOrientation:"+event.eventData.screenOrientation);
			// setTimeout(function(){
			// 	var windowSize = EBG.API.Adaptor.getViewPortMetrics();
			// 	if (_self.isExpanded === true ) {
			// 		_self.setMarginTop(windowSize.height);	
			// 	}			
			// 	EBG.API.Adaptor.setStyle(_self.panelFrm, {
			// 		position: "fixed",
			// 		top:EBG.px(0),
			// 		left: EBG.px(0),
			// 		width: EBG.px(windowSize.width),
			// 		height: EBG.px(windowSize.height),
			// 		fontSize: "0px",
			// 		whiteSpace: "nowrap",
			// 		visibility: "visible"
			// 	});
			// 	EBG.API.Adaptor.setStyle(_self.panelDiv, {
			// 		position: "fixed",
			// 		top:EBG.px(0),
			// 		left: EBG.px(0),
			// 		width: EBG.px(windowSize.width),
			// 		height: EBG.px(windowSize.height),
			// 		fontSize: "0px",
			// 		whiteSpace: "nowrap",
			// 		visibility: "visible"
			// 	});
			// }, 50);
		},

		_handleCreativeContainerReady: function (event) {
			_self.log("_handleCreativeContainerReady:" + (event.dispatcher.panelName || "banner"));
			if(_self.wasPolite && !event.dispatcher.panelName) {
				_self.iframe = EBG.API.Banner.getElements(uid).banner;
				_self.bannerDiv = EBG.API.Banner.getElements(uid).bannerDiv;
				_self._onloadInjectCSSandJS(event); //if we were a polite load, banner ready is our onload time to call this
			}
			var ifrmCC = event.dispatcher;
			_self.CCs = _self.CCs || {};
			_self.CCs[ifrmCC.iframeId] = ifrmCC;
			// need to send data type as a property in msg data for safe frames
			ifrmCC._sendMessage("sendCreativeId", {
				type: "sendCreativeId",
				creativeIFrameId: ifrmCC.iframeId,
				uid: uid,
				viewport: EBG.API.Adaptor.getViewPortMetrics()
			});

			//This block of code below ensures that if we have a 1x1 banner, then we switch viewability to the default panel
			//if banner, record the w/h and create a boolean 1x1 for later checking
			if(!event.dispatcher.panelName) {
				_self.banner1x1 = ifrmCC._iframe.width === "1" && ifrmCC._iframe.height === "1";
			}
			//else if default panel (or change to your chosen panel if you don't want default) and banner was earlier detected to be 1x1
			else if(event.dispatcher.panelName.toLowerCase() === _self.defaultPanelName.toLowerCase() && _self.banner1x1) {
				//then set the viewability banner tracking to use the panel as it's target element
				EBG.API.Banner.setViewabilityElem(uid, event.dispatcher._iframe.id);
			}
		},
		_handleBeforeAdUnload: function (event) {
			//If anything is added to the publisher's page by us, this is where we need to remove it.

			_self.log("_handleBeforeAdUnload");
			// Execute JS and inject CSS if any was used in Programmatic Settings

			// remove any css that was injected on ad load if option selected to remove on ad unload
			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoad") && EBG.API.Ad.getCustomVar(uid, "_mdCssOnLoadRemoveOnUnload")) {
				_self.stylesheetOnLoad.parentNode.removeChild(_self.stylesheetOnLoad);
			}

			if(EBG.API.Ad.getCustomVar(uid, "_mdCssOnUnload")) {
				// inject CSS to top window
				_self.addStylesheetToHead(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdCssOnUnload"), event.dispatcher));
			}
			if(EBG.API.Ad.getCustomVar(uid, "_mdJsOnUnload")) {
				// execute JS on top window
				_self.execJS(_self.tokenReplace(EBG.API.Ad.getCustomVar(uid, "_mdJsOnUnload"), event.dispatcher));
			}
		},

		//-------------------------------------------------
		//End of Event Handlers Section
		//=================================================

		//=================================================
		// Custom Event Methods
		//-------------------------------------------------

		dispatchCustomScriptEvent: function (eventName, params) {
			var paramsData = {
				type: "dispatchCustomScriptEvent",
				data: params || {}
			};
			paramsData.data.uid = uid;
			paramsData.data.eventName = eventName;
			_self._handleMessageReceived(undefined, paramsData);
		},

		addCustomScriptEventListener: function (eventName, callback, interAd) {
			var data = {
				uid: uid,
				listenerId: Math.ceil(Math.random() * 1000000000),
				eventName: eventName,
				interAd: !!(interAd),
				callback: callback
			};
			_self._handleMessageReceived(undefined, {
				data: data,
				type: "addCustomScriptEventListener"
			});
			return data.listenerId;
		},

		removeCustomScriptEventListener: function (listenerId) {
			_self._handleMessageReceived(undefined, {
				data: {
					uid: uid,
					listenerId: listenerId
				},
				type: "removeCustomScriptEventListener"
			});
		},

		//-------------------------------------------------
		//End of Custom Event Methods
		//=================================================

		//=================================================
		// Custom Vars Related Functions
		//-------------------------------------------------
		initCustomVarDefaults: function () {
			//_self.log("initCustomVars", _self.defaultCustomFormatVars);
			for(var cv in _self.defaultCustomFormatVars) {
				if(!_self.defaultCustomFormatVars.hasOwnProperty(cv)) {continue;}
				_self.setDefault(cv, _self.defaultCustomFormatVars[cv]); // once undefined allowed to be set by type (not "undefined"), replace this line with API setCustomVar
			}
		},

		setDefault: function (varName, defaultValue, optional_override) {
			//_self.log("setDefault",arguments);
			EBG.API.Ad.setCustomVar(uid, varName, defaultValue, !!optional_override);
			_self[varName] = EBG.API.Ad.getCustomVar(uid, varName);
		},

		//this one lets you append strings to an existing string custom var, with optional delimiter
		setDefaultWithAppend: function (varName, defaultValue, optionalDelimiter) {
			var delim = optionalDelimiter || "";
			var val = EBG.API.Ad.getCustomVar(uid, varName); //see if we already have a string in there
			//_self.log("setDefaultWithAppend, current = "+val);
			val = typeof val === "string" ? (val + delim + defaultValue) : defaultValue;
			//_self.log("setDefaultWithAppend, new = "+val);
			_self.setDefault(varName, val, true);
		},
		//-------------------------------------------------
		//End of Custom Vars Related Functions Section
		//=================================================

		//=================================================
		// Utility Functions
		//-------------------------------------------------
		dispatchScrollPos: function (useDelay) {
			if(useDelay) {
				window.setTimeout(_self.dispatchScrollPos, 250);
				return;
			}
			var scrollPos = _self.getScrollPos();
			if(_self.isBannerReady && (_self.curScrollPos.scrollXPercent !== scrollPos.scrollXPercent || _self.curScrollPos.scrollYPercent !== scrollPos.scrollYPercent)) {
				_self.curScrollPos.scrollXPercent = scrollPos.scrollXPercent;
				_self.curScrollPos.scrollYPercent = scrollPos.scrollYPercent;
				_self.dispatchCustomScriptEvent('pageScroll', scrollPos);
			}
		},

		getScrollPos: function () {
			var pageMetrics = EBG.API.Adaptor.getPageMetrics(_self.pm.topWin);
			var vp = EBG.API.Adaptor.getViewPortMetrics(_self.pm.topWin);
			var scrollYPercent = 0;
			var scrollXPercent = 0;
			if((pageMetrics.scrollWidth - vp.width) > 0) {
				scrollXPercent = parseInt((pageMetrics.scrollLeft / (pageMetrics.scrollWidth - vp.width)) * 100);
			}
			if((pageMetrics.scrollHeight - vp.height) > 0) {
				scrollYPercent = parseInt((pageMetrics.scrollTop / (pageMetrics.scrollHeight - vp.height)) * 100);
			}
			return {
				scrollXPercent: Math.min(Math.max(scrollXPercent, 0), 100),
				scrollYPercent: Math.min(Math.max(scrollYPercent, 0), 100)
			};
		},

		log: function () { // this is a closure-compiled version of the original code
			if(_self.isDebug) {
				var b, a;
				b = Array.prototype.slice.call(arguments);
				a = new Date();
				a = scriptName + " (" + a.getFullYear() + "-" + a.getMonth() + "-" + a.getDate() + " " + a.getHours() + ":" + a.getMinutes() + ":" + a.getSeconds() + "." + a.getMilliseconds() + "): ";
				b.unshift(a);
				try {
					window.console && console.log && (console.log.apply ? console.log.apply(console, b) : console.log(b));
				}
				catch(e) {}
			}
		},

		removeAd: function () {
			EBG.API.Ad.unload(uid);
		},

		addWindowListener: function (eventName, handlerIndex, func) { //add an overrideable listener
			_self.handlers[handlerIndex] = function () {
				return func.apply(this, arguments);
			}; //make this handler overrideable by plugin script
			if(_self.displayWin.addEventListener){
				_self.displayWin.addEventListener(eventName, _self.handlers[handlerIndex], false);
			}
			else if(_self.displayWin.attachEvent){
				_self.displayWin.attachEvent("on" + eventName, _self.handlers[handlerIndex]);
			}
		},

		removeWindowListener: function (eventName, handlerIndex, func) { //remove an overrideable listener
			if(_self.displayWin.removeEventListener){
				_self.displayWin.removeEventListener(eventName, _self.handlers[handlerIndex], false);
			}
			else if(_self.displayWin.detachEvent){
				_self.displayWin.detachEvent("on" + eventName, _self.handlers[handlerIndex]);
			}
			delete _self.handlers[handlerIndex];
		},

		handleSetCreativeVersion: function (event) { //handle the setCreativeVersion event received from the HTML5 Banner
			_self.versions["creativeIds"] += ((_self.versions["creativeIds"] !== "" ? "|" : "") + event.creativeId);
			_self.versions["creativeVers"] += ((_self.versions["creativeVers"] !== "" ? "|" : "") + event.creativeVersion);
			_self.versions["creativeLastMods"] += ((_self.versions["creativeLastMods"] !== "" ? "|" : "") + event.creativeLastModified);
		},

		showFullSizedBackupImage: function () {
			try {
				var backupImg = EBG.API.Ad.getAdData(uid, "assets")[_self.mdBackupImgPath];
				if(!backupImg){ return;}

				if(!_self.ebDiv) {
					_self.ebDiv = EBG.API.Ad.getPlaceholder(uid);
				}

				var img = _self.ebDiv.firstChild;
				var w = img.width = backupImg.width;
				var h = img.height = backupImg.height;
				var path = backupImg.dsPath;

				//resize the placeholder div to our backup image's width and height
				EBG.API.Adaptor.setStyleToElems([_self.ebDiv, img], {
					width: EBG.px(w),
					height: EBG.px(h)
				});

				img.src = EBG.API.Ad.getAdData(uid, "resourcePath") + path;

				//if any parent div's need updating, do that here
				//e.g. one parent level: _self.ebDiv.parentNode.style.width = EBG.px(w); _self.ebDiv.parentNode.style.height = EBG.px(h);
				//e.g. two parent levels: _self.ebDiv.parentNode.parentNode.style.width = EBG.px(w); _self.ebDiv.parentNode.parentNode.style.height = EBG.px(h);
				//e.g. three parent levels: _self.ebDiv.parentNode.parentNode.parentNode.style.width = EBG.px(w); _self.ebDiv.parentNode.parentNode.parentNode.style.height = EBG.px(h);

				if(_self.mdParentLevelsToResize > 0) {
					setTimeout(function () {
						_self.resizeBackupImageParentNodes(w, h, _self.mdParentLevelsToResize);
					}, 100);
				}
			}
			catch(e) {}
		},

		resizeBackupImageParentNodes: function (w, h, nodes) {
			try {
				var parentNodes = [
					_self.ebDiv.parentNode,
				];
				//fill up the array with ever higher parent nodes to the length instructed
				for(var n = 1; n < nodes; n++) {
					parentNodes[n] = parentNodes[n - 1].parentNode;
				}

				var parentMetrics;
				for(var i = 0; i < parentNodes.length; i++) {
					var parentNode = parentNodes[i];

					if(parentNode) {
						parentMetrics = EBG.API.Adaptor.getElementMetrics(parentNode);
						if(parentMetrics.width < w) {
							EBG.API.Adaptor.setStyle(parentNode, {
								minWidth: EBG.px(w)
							});
						}

						if(parentMetrics.height < h) {
							EBG.API.Adaptor.setStyle(parentNode, {
								minHeight: EBG.px(h)
							});
						}
					}
				}
			}
			catch(e) {}
		},

		tokenReplace: function (str, panel) {
			var replaced = str.replace(/\%ebDivID\%/g, _self.ebDiv.id);
			if(panel && panel.panelName) {
				replaced = replaced.replace(/\%panelIframeID\%/g, panel.iframeId);

				// sometimes the div is already removed, you can't access the ID, so when this happens, just don't replace
				if(panel._iframe.parentNode && panel._iframe.parentNode.id) {replaced = replaced.replace(/\%panelDivID\%/g, panel._iframe.parentNode.id);}
			}
			replaced = replaced.replace(/\%bannerIframeID\%/g, _self.iframe.id);
			replaced = replaced.replace(/\%bannerDivID\%/g, _self.iframe.parentNode.id);
			replaced = replaced.replace(/\%defaultPanelName\%/g, _self.defaultPanelName);
			replaced = replaced.replace(/\%adid\%/g, adId);
			replaced = replaced.replace(/\%rnd\%/g, rnd);
			replaced = replaced.replace(/\%uid\%/g, uid);
			replaced = _self.htmlUnencode(replaced);
			return replaced;
		},

		htmlUnencode: function (str) {
			var elem = document.createElement("div");
			elem.innerHTML = str;
			return(elem.innerText || elem.text || elem.textContent);
		},

		addStylesheetToHead: function (styleSheetRules, optionalTargetDoc) {
			var targetDoc = optionalTargetDoc || _self.pm.topDoc;
			var styleElement = targetDoc.createElement('style');
			styleElement.setAttribute('type', 'text/css');
			if(styleElement.styleSheet) {
				styleElement.styleSheet.cssText = styleSheetRules;
			}
			else {
				styleElement.appendChild(targetDoc.createTextNode(styleSheetRules));
			}
			targetDoc.getElementsByTagName('head')[0].appendChild(styleElement);
			return styleElement;
		},

		execJS: function (jsToExec) {
			try {
				_self.pm.topWin.eval(jsToExec);
			}
			catch(e) {}
		},

		reportCFVersions: function () { //report 'our' versions in this ad, may or may not be called by our own reportCFV function
			var saveDebug = _self.isDebug; //save current debug state
			_self.isDebug = true; //ensure it's true for this version log
			var delim = "",
				s = "reportCFVersions:uid:" + uid + ": ";
			for(var v in _self.versions) {
				if(_self.versions.hasOwnProperty(v)) {
					s += (delim + v + ": " + _self.versions[v]);
					delim = ", ";
				}
			}
			_self.log(s);
			_self.isDebug = saveDebug; //restore debug to what it was
		},

		versions: {
			"scriptVer": scriptVersion,
			"scriptLastMod": lastModified,
			"templateVer": templateVersion,
			"creativeIds": "",
			"creativeVers": "",
			"creativeLastMods": ""
		},
		//-------------------------------------------------
		//End of Utility Functions
		//=================================================


		onExpandRequested:function(){		
			_self.setMarginTop(EBG.API.Adaptor.getViewPortMetrics().height+EBG.API.Adaptor.getScrollLeftTop().Y);
			// SELF.displayWindow.document.body.classList.add("vbExpanded");
			// SELF.displayWindow.document.body.classList.remove("vbCollapsed");
		},
		onCollapseRequested:function(){
			_self.setMarginTop(_self.marginTop);
			// SELF.displayWindow.document.body.classList.add("vbCollapsed");
			// SELF.displayWindow.document.body.classList.remove("vbExpanded");
		},
		setMarginTop:function(marginTop){
			_self.pushDiv.style.setProperty("margin-top", marginTop+"px", "important");
		},
		loadExternalJSON:function (callback,pathToFile) { 
		    var xobj = new XMLHttpRequest();
		    xobj.overrideMimeType("application/json");
		    xobj.open('GET', pathToFile, true);
		    xobj.onreadystatechange = function () {
		          if (xobj.readyState === 4 && xobj.status === "200") {
		            callback(xobj.responseText);
		          }
		    };
		    xobj.send(null);  
		 },
		moveElement: function (referenceDiv, elem, insertionType) {
		    switch (insertionType) {
		        case "first":
		            if (referenceDiv.firstChild) {referenceDiv.insertBefore(elem, referenceDiv.firstChild);}
		            else {referenceDiv.appendChild(elem);}
		            break;
		        case "last":
		            referenceDiv.appendChild(elem);
		            break;
		        case "after":
		            if (referenceDiv.nextSibling) {referenceDiv.parentNode.insertBefore(elem, referenceDiv.nextSibling);}
		            else {referenceDiv.parentNode.appendChild(elem);}
		            break;
		        case "before":
		        	break;
		        default:
		            referenceDiv.parentNode.insertBefore(elem, referenceDiv);
		            break;
		    }
        },

		//-------------------------------------------------
		//Start of ProgrammaticManager Class
		//=================================================

		ProgrammaticManager: function (progReadyCallback) {
			/** start constructor **/
			_self.pm = this;
			_self.pm.constructor = function () {
				_self.pm.readyCallback = progReadyCallback;
				_self.pm.topWin = _self.pm.getTopWin(window);
				_self.pm.topDoc = _self.pm.topWin.document;
				_self.pm.PROGRAMMATIC_SETTINGS_FILENAME = "ProgrammaticSettings_" + progFormatID + ".json";
				_self.pm.DEFAULT_PROGRAMMATIC_SETTING_FOLDER = "_default_";
				_self.pm.mdSettingsFolderPath = EBG.API.Ad.getCustomVar(uid, "mdProgSettingsFolderPath");
				_self.pm.currentFileRequested = null;
				_self.pm.currentDetectMethod = null;
				var enabled = false;
				if(adConfig.customJSVars.hasOwnProperty("mdIsDomainConfigEnabled"))	{		//preferred, newest
					enabled = EBG.API.Ad.getCustomVar(uid, "mdIsDomainConfigEnabled");
				}
				if(!enabled && adConfig.customJSVars.hasOwnProperty("mdIsProgEnabled")) {	//next most recent [now deprecated]
					enabled = EBG.API.Ad.getCustomVar(uid, "mdIsProgEnabled");
				}
				if(!enabled && adConfig.customJSVars.hasOwnProperty("mdProgEnabled")) {		//mis-used one [now deprecated]
					enabled = EBG.API.Ad.getCustomVar(uid, "mdProgEnabled");
				}
				if(!enabled && adConfig.customJSVars.hasOwnProperty("mdProgEnable")) {		//oldest [now deprecated]
					enabled = EBG.API.Ad.getCustomVar(uid, "mdProgEnable");
				}
				// getter
				_self.pm.isEnabled = function () {
					return(!!enabled);
				};

				if(_self.pm.isEnabled()) {
					_self.pm.getProgrammaticSettings();
				}
				else {
					_self.pm.beginExperience();
				}
			};

			_self.pm.getProgrammaticSettings = function () {
				var queries = _self.pm.getQueryVariables();
				var domainName;
				// detect domain using cookie settings or querystring force
				// When using ProgrammaticPreview, query string values are used
				if(queries && queries.domain) {
					_self.pm.currentDetectMethod = "queries";
					domainName = queries.domain;
				}
				else {
					//we considered using referrer but determined it to be risky, we just don't know how reliable it is
					//did parent create iframe or was iframe being re-used and we'd get the URL of the previous ad etc.

					// first try determining the domain using cookies. Quick and no requests necessary
					_self.pm.currentDetectMethod = "cookies";
					domainName = _self.pm.getDomainUsingCookies(_self.pm.topDoc.domain);

					// if we didn't detect the domain using cookies, try using our known TLD list
					if(!domainName) {
						var tldLength = _self.pm.knownTLD(_self.pm.topDoc.domain);
						if(tldLength) {
							// we know the domain is using a "known" tld, so we just grab the section immediately before that
							_self.pm.currentDetectMethod = "tld";
							domainName = _self.pm.topDoc.domain;
							domainName = domainName.substring(Math.max(domainName.lastIndexOf(".", domainName.length - tldLength - 1), 0) + 1);
						}
					}
				}
				// if testing using cookies and it fails, we end up setting domain to default at end
				if(domainName) { // domain detected, ready to load
					_self.pm.loadSettingsFile(domainName);
				}
				else { // detect domain attempting to load settings file
					_self.pm.getDomainUsingClientLoad(_self.pm.topDoc.domain);
				}
			};

			_self.pm.getTopWin = function (thisWin) { // taken from PL_DetectServingEnvironment_All.js
				thisWin = thisWin || window;
				var topWin;
				try { // first just try to grab top document. If we're in a friendly iframe, or script tag, this will work fine
					topWin = top.document && top;
					if(typeof topWin === "undefined") {
						throw "MacSafariTopWinUFIF"; //force getParentest...
					}
				}
				catch(e) { // if we fail/error out on getting top, try looping through parents to get the top-most window
					topWin = _self.pm.getParentestFriendlyWin(thisWin);
				}
				if(typeof topWin === "undefined") topWin = _self.pm.getParentestFriendlyWin(thisWin);
				return topWin;
			};

			_self.pm.getParentestFriendlyWin = function (curWin, refWin) { // using curWin as our current window, try to determine how high up through parents we can go to find
				//	the top most friendly window object.
				var pfWin;
				try {
					refWin = refWin || curWin.parent;
					pfWin = curWin.document && curWin;
					if(typeof pfWin == "undefined") {
						throw "MacSafariWinUFIF";
					}
					if(refWin !== curWin) {
						pfWin = refWin.document && refWin;
						if(typeof pfWin === "undefined") {
							return curWin.document && curWin;
						}
						if(refWin !== top) {
							pfWin = _self.pm.getParentestFriendlyWin(refWin) || pfWin;
						}
					}
				}
				catch(e) {
					if(refWin !== top) {
						pfWin = _self.pm.getParentestFriendlyWin(refWin) || pfWin;
					}
				}
				if(typeof pfWin === "undefined") {
					//Ad must be stuck in an unfriendly iframe, unable to get any higher in DOM.
					try {
						pfWin = curWin.document && curWin;
					}
					catch(e) {}
				}
				return pfWin;
			};

			_self.pm.getQueryVariables = function () {
				var qsv = {}; // query string variables object
				var kv = {}; // key value pairs object
				var query = _self.pm.topWin.location.search.substring(1); // remove leading questionmark from querystring
				var vars = query.split("&");
				for(var i = 0; i < vars.length; i++) {
					kv.name = decodeURIComponent(vars[i].substring(0, vars[i].indexOf("=")));
					kv.value = decodeURIComponent(vars[i].substring(vars[i].indexOf("=") + 1));
					qsv[kv.name] = kv.value;
				}
				return qsv;
			};

			_self.pm.loadSettingsFile = function (domain) {
				_self.pm.currentFileRequested = domain;
				if(!EBG.getDataFromRemoteServer(_self.pm.buildSettingsURL(domain), _self.pm.parseJSON, _self.pm, true)) {
					_self.pm.beginExperience();
				}
			};

			// this function returns the length of the TLD if the TLD is known, otherwise returns 0
			_self.pm.knownTLD = function (testDomain) {
				// this list of TLDs provided by R&D from top 10000 sites that served impressions for ads
				var knownTLDs = ['.com', '.net', '.mobi', '.cci.fr', '.fr', '.com.au', '.es', '.co.uk', '.de', '.com.cn', '.it', '.be', '.fi', '.co.il', '.co.jp', '.ne.jp', '.jp', '.nl', '.me', '.com.pl', '.pl', '.tv', '.qc.ca', '.ca', '.io', '.io.', '.com.vn', '.net.vn', '.vn', '.com.br', '.gr', '.com.ar', '.com.tr', '.co.th', '.cz', '.ch', '.dk', '.org', '.no', '.biz', '.co.nz', '.se', '.pt', '.com.my', '.co', '.co.in', '.ro', '.com.hk', '.fm', '.com.tw', '.com.al', '.al', '.cc', '.web.id', '.co.za', '.com.mx', '.video', '.at', '.info', '.trade', '.cl', '.sk', '.to', '.pe', '.cn', '.us', '.in', '.lt', '.mx', '.bg', '.eu', '.co.id', '.com.sg', '.gg', '.hn', '.my', '.la', '.com.pk', '.pk', '.com.kw', '.guru', '.hk', '.hr', '.lv', '.rs', '.ee', '.com.uy', '.asia', '.mus.br', '.cat', '.gov.au', '.id', '.ru', '.gov.uk', '.com.cy', '.tw', '.nu', '.online', '.ie', '.in.th', '.hu', '.news', '.free', '.tf', '.com.sa', '.sa', '.lk', '.website', '.ba', '.sc', '.com.ph', '.ph', '.media', '.pr', '.xyz', '.az', '.app', '.gen.tr', '.md', '.net.br', '.cf', '.com.gh', '.club', '.lu', '.com.do', '.ws', '.co.kr', '.eus', '.one', '.net.au', '.social', '.si', '.am', '.pw', '.mk', '.im', '.best', '.com.ua', '.ua', '.lat', '.pm', '.com.lb', '.ae', '.dj', '.win', '.tt'];
				for(var i = 0; i < knownTLDs.length; i++) {
					if(testDomain.substr(-knownTLDs[i].length) === knownTLDs[i]) {return knownTLDs[i].length;}
				}
				return 0;
			};

			_self.pm.getDomainUsingCookies = function (testDomain) {
				if(!_self.pm.topDoc || !navigator.cookieEnabled) {return false;}
				try {
					var i = 0;
					var s = "_" + uid + "_" + (new Date()).getTime();
					var p = testDomain.split(".");
					while(i < (p.length - 1) && _self.pm.topDoc.cookie.indexOf(s + "=" + s) === -1) {
						testDomain = p.slice(-1 - (++i)).join(".");
						_self.pm.topDoc.cookie = s + "=" + s + ";domain=" + testDomain + ";";
					}
					if(_self.pm.topDoc.cookie.indexOf(s + "=" + s) === -1) {testDomain = "";}
					try {
						_self.pm.topDoc.cookie = s + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;domain=" + testDomain + ";";
					}
					catch(e) {}
					return testDomain;
				}
				catch(e) {
					return false;
				}
			};
			_self.pm.getDomainUsingClientLoad = function (docDomain, domsToIgnore) {
				var domainAsArray;
				var domainParts = 0;
				var checkDomain = '';
				var checkURL = '';
				var filesToCheck = [];
				domsToIgnore = [].concat(domsToIgnore);

				_self.pm.currentDetectMethod = "clientLoad";

				domainAsArray = docDomain.split(".");

				while(domainParts < domainAsArray.length - 1) {
					checkDomain = domainAsArray.slice(-1 - (++domainParts)).join(".");
					if(domsToIgnore.indexOf(checkDomain) >= 0) {continue;}
					checkURL = _self.pm.buildSettingsURL(checkDomain);
					filesToCheck[filesToCheck.length] = checkURL;
				}

				filesToCheck[filesToCheck.length] = _self.pm.buildSettingsURL(_self.pm.DEFAULT_PROGRAMMATIC_SETTING_FOLDER);

				function loadFile(url) {
					return EBG.getDataFromRemoteServer(url, function (result) {
						if(result) {
							_self.pm.parseJSON(result);
						}
						else {
							if(filesToCheck.length > 0) {
								if(!loadFile(filesToCheck.shift())) {
									_self.pm.beginExperience();
								}
							}
							else {
								// No settings were found, load ad anyway without override
								_self.pm.beginExperience();
							}
						}
					}, _self, true);
				}

				if(!loadFile(filesToCheck.shift())) {
					_self.pm.beginExperience();
				}
			};
			_self.pm.buildSettingsURL = function (domainToBuild) {
				return _self.pm.topDoc.location.protocol + _self.pm.mdSettingsFolderPath + domainToBuild + "/" + _self.pm.PROGRAMMATIC_SETTINGS_FILENAME + "?ord=" + uid;
			};
			_self.pm.unbuildSettingsURL = function (urlToUnbuild) {
				var pattern = new RegExp(_self.pm.topDoc.location.protocol + _self.pm.mdSettingsFolderPath + "(.*)/" + _self.pm.PROGRAMMATIC_SETTINGS_FILENAME + "\\?ord=" + uid);
				return pattern.exec(urlToUnbuild)[1];
			};
			_self.pm.parseJSON = function (response) {
				if(!response) {
					// If we don't have a response, it could mean we need to try loading our default folder
					// It could also mean, if it came from the KnownTLD, we must now use the regular requests method.
					// if our default setting file WAS the one that had no response, no other option
					// must simply load the ad without any programmatic settings
					if(_self.pm.currentDetectMethod === "tld") {
						// need to get files by client request, IGNORING the current file which was part of the known TLD....
						_self.pm.getDomainUsingClientLoad(_self.pm.topDoc.domain, _self.pm.currentFileRequested);
						return;
					}
					else if(_self.pm.currentFileRequested !== _self.pm.DEFAULT_PROGRAMMATIC_SETTING_FOLDER) {
						_self.pm.loadSettingsFile(_self.pm.DEFAULT_PROGRAMMATIC_SETTING_FOLDER, _self.pm.parseJSON);
						return;
					}
					else {
						_self.pm.beginExperience();
						return;
					}
				}

				try {
					// wrapped in try/catch in case anything breaks we still are able to load our ad experience

					// read setting file, apply custom variable settings, then do the below line to show the panel
					var responseSettings = JSON.parse(response).programmaticSettings;
					var queries = _self.pm.getQueryVariables();
					var programmaticSettings = null;

					if(queries && queries.settingType) {
						switch(queries.settingType) {
						case "Folder":
							if(responseSettings.hasOwnProperty("folder") && responseSettings.folder.hasOwnProperty(queries.settingDetail)) {
								programmaticSettings = responseSettings.folder[queries.settingDetail];
							}
							break;
						case "Subdomain":
							if(responseSettings.hasOwnProperty("subdomain") && responseSettings.subdomain.hasOwnProperty(queries.settingDetail)) {
								programmaticSettings = responseSettings.subdomain[queries.settingDetail];
							}
							break;
						case "Global":
							if(responseSettings.hasOwnProperty("global")) {
								programmaticSettings = responseSettings.global;
							}
							break;
						}
					}
					else {
						var setting;
						if(!programmaticSettings && responseSettings.folder) {
							var f = responseSettings.folder;
							for(setting in f) {
								if(!f.hasOwnProperty(setting)) {continue;}
								if(_self.pm.hasFolder(setting)) {
									programmaticSettings = f[setting];
									break;
								}
							}
						}
						if(!programmaticSettings && responseSettings.subdomain) {
							var s = responseSettings.subdomain;
							for(setting in s) {
								if(!s.hasOwnProperty(setting)) {continue;}
								if(_self.pm.hasSubdomain(setting)) {
									programmaticSettings = s[setting];
									break;
								}
							}
						}
						if(!programmaticSettings && responseSettings.global) {
							programmaticSettings = responseSettings.global;
							// simply grab first "global" setting and apply it to custom vars
						}
					}

					// If it is NOT ready, then add an event handler to do the below once it IS ready
					if(programmaticSettings) {_self.pm.setProgrammaticSettings(programmaticSettings);}
					_self.pm.beginExperience();
				}
				catch(e) {
					// if anything broke during parsing, simply begin the ad experience
					_self.pm.beginExperience();
				}
			};
			_self.pm.hasFolder = function (folderToTest) {
				return(_self.pm.topDoc.location.pathname.indexOf(folderToTest) !== -1);
			};
			_self.pm.hasSubdomain = function (subdomainToTest) {
				return(_self.pm.topDoc.location.hostname.indexOf(subdomainToTest) !== -1 || _self.pm.topDoc.location.host.indexOf(subdomainToTest) !== -1);
			};
			_self.pm.setProgrammaticSettings = function (programmaticSettings) {
				for(var customVar in programmaticSettings) {
					if(!programmaticSettings.hasOwnProperty(customVar)) {continue;}
					_self.setDefault(customVar, programmaticSettings[customVar], true);
				}
			};
			_self.pm.beginExperience = function () {
				if(_self.pm.readyCallback){ window.setTimeout(_self.pm.readyCallback, 1);}
			};

			_self.pm.constructor(); // call constructor
		}
		//-------------------------------------------------
		//End of ProgrammaticManager Class
		//=================================================

	};

	EBG.reportCFV = function () {
		for(var i in EBG.customFormats) {
			if(EBG.customFormats.hasOwnProperty(i)) {
				for(var x in EBG.customFormats[i]) {
					if(EBG.customFormats[i].hasOwnProperty(x)) {
						try {
							EBG.customFormats[i][x].reportCFVersions();
						}
						catch(e) {}
					}
				}
			}
		}
	};

	/**************************************************************************/
	/*Initialization : Must be down here after the prototype is fully defined */
	/**************************************************************************/
	EBG.customFormats[uid][scriptName] = new CustomFormat(); //create our '_self' class object which holds all of our functionality
});