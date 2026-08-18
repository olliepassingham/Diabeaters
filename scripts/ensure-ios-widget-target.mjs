#!/usr/bin/env node
/**
 * Ensures OsSurfaces + Shared Swift sources are in the App target, and that the
 * DiabeatersWidgetExtension WidgetKit target exists (Lock Screen widget + Live Activity).
 * Idempotent.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pbxPath = join(process.cwd(), "ios", "App", "App.xcodeproj", "project.pbxproj");
if (!existsSync(pbxPath)) {
  console.error(`Missing ${pbxPath}`);
  process.exit(1);
}

let pbx = readFileSync(pbxPath, "utf8");

function insertBefore(marker, chunk) {
  const probe = chunk.replace(/^\s+/, "").slice(0, 60);
  if (probe && pbx.includes(probe)) return;
  if (!pbx.includes(marker)) {
    throw new Error(`Marker not found: ${marker}`);
  }
  pbx = pbx.replace(marker, `${chunk}${marker}`);
}

function ensureLineInBlock(needle, line) {
  if (pbx.includes(line.trim())) return;
  if (!pbx.includes(needle)) {
    throw new Error(`Needle not found: ${needle}`);
  }
  pbx = pbx.replace(needle, `${needle}${line}`);
}

// --- App target: OsSurfacesPlugin + Shared models ---
if (!pbx.includes("OsSurfacesPlugin.swift in Sources")) {
  insertBefore(
    "/* End PBXBuildFile section */",
    `\t\tA1OSURF01FED796500168570 /* OsSurfacesPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1OSURF00FED796500168570 /* OsSurfacesPlugin.swift */; };
\t\tA1SHARE01FED796500168571 /* DiabeatersSharedStatus.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */; };
\t\tA1SHARE03FED796500168572 /* ExerciseLiveActivityAttributes.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE02FED796500168572 /* ExerciseLiveActivityAttributes.swift */; };
`,
  );
  insertBefore(
    "/* End PBXFileReference section */",
    `\t\tA1OSURF00FED796500168570 /* OsSurfacesPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OsSurfacesPlugin.swift; sourceTree = "<group>"; };
\t\tA1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = DiabeatersSharedStatus.swift; path = ../Shared/DiabeatersSharedStatus.swift; sourceTree = "<group>"; };
\t\tA1SHARE02FED796500168572 /* ExerciseLiveActivityAttributes.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = ExerciseLiveActivityAttributes.swift; path = ../Shared/ExerciseLiveActivityAttributes.swift; sourceTree = "<group>"; };
`,
  );
  ensureLineInBlock(
    "\t\t\t\t504EC32B1FED79650016856F /* HealthAuthorizationPlugin.swift */,\n",
    `\t\t\t\tA1OSURF00FED796500168570 /* OsSurfacesPlugin.swift */,
\t\t\t\tA1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */,
\t\t\t\tA1SHARE02FED796500168572 /* ExerciseLiveActivityAttributes.swift */,
`,
  );
  ensureLineInBlock(
    "\t\t\t\t504EC32C1FED79650016856F /* HealthAuthorizationPlugin.swift in Sources */,\n",
    `\t\t\t\tA1OSURF01FED796500168570 /* OsSurfacesPlugin.swift in Sources */,
\t\t\t\tA1SHARE01FED796500168571 /* DiabeatersSharedStatus.swift in Sources */,
\t\t\t\tA1SHARE03FED796500168572 /* ExerciseLiveActivityAttributes.swift in Sources */,
`,
  );
}

// --- App target: WatchConnectivity bridge (phone half of the Watch companion) ---
if (!pbx.includes("OsSurfacesWatchBridge.swift in Sources")) {
  insertBefore(
    "/* End PBXBuildFile section */",
    `\t\tA1WCHBF00FED796500168600 /* OsSurfacesWatchBridge.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WCHFR00FED796500168600 /* OsSurfacesWatchBridge.swift */; };
\t\tA1WCHBF01FED796500168601 /* WatchConnectivity.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = A1WCHFR01FED796500168601 /* WatchConnectivity.framework */; };
`,
  );
  insertBefore(
    "/* End PBXFileReference section */",
    `\t\tA1WCHFR00FED796500168600 /* OsSurfacesWatchBridge.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OsSurfacesWatchBridge.swift; sourceTree = "<group>"; };
\t\tA1WCHFR01FED796500168601 /* WatchConnectivity.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = WatchConnectivity.framework; path = System/Library/Frameworks/WatchConnectivity.framework; sourceTree = SDKROOT; };
`,
  );
  ensureLineInBlock(
    "\t\t\t\tA1OSURF00FED796500168570 /* OsSurfacesPlugin.swift */,\n",
    "\t\t\t\tA1WCHFR00FED796500168600 /* OsSurfacesWatchBridge.swift */,\n",
  );
  ensureLineInBlock(
    "\t\t\t\tA1OSURF01FED796500168570 /* OsSurfacesPlugin.swift in Sources */,\n",
    "\t\t\t\tA1WCHBF00FED796500168600 /* OsSurfacesWatchBridge.swift in Sources */,\n",
  );
  ensureLineInBlock(
    "\t\t\t\t4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,\n",
    "\t\t\t\tA1WCHBF01FED796500168601 /* WatchConnectivity.framework in Frameworks */,\n",
  );
}

// --- Widget extension target ---
if (!pbx.includes("DiabeatersWidgetExtension")) {
  insertBefore(
    "/* Begin PBXProject section */",
    `
/* Begin DiabeatersWidget extension */
\t\tA1WGTBF01FED796500168580 /* DiabeatersWidgetBundle.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WGTFR01FED796500168580 /* DiabeatersWidgetBundle.swift */; };
\t\tA1WGTBF02FED796500168581 /* DiabeatersStatusWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WGTFR02FED796500168581 /* DiabeatersStatusWidget.swift */; };
\t\tA1WGTBF03FED796500168582 /* ExerciseLiveActivityWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WGTFR03FED796500168582 /* ExerciseLiveActivityWidget.swift */; };
\t\tA1WGTBF04FED796500168583 /* DiabeatersSharedStatus.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */; };
\t\tA1WGTBF05FED796500168584 /* ExerciseLiveActivityAttributes.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE02FED796500168572 /* ExerciseLiveActivityAttributes.swift */; };
\t\tA1WGTBF06FED796500168585 /* DiabeatersWidgetExtension.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = A1WGTPR01FED796500168590 /* DiabeatersWidgetExtension.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
\t\tA1WGTFR01FED796500168580 /* DiabeatersWidgetBundle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiabeatersWidgetBundle.swift; sourceTree = "<group>"; };
\t\tA1WGTFR02FED796500168581 /* DiabeatersStatusWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiabeatersStatusWidget.swift; sourceTree = "<group>"; };
\t\tA1WGTFR03FED796500168582 /* ExerciseLiveActivityWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ExerciseLiveActivityWidget.swift; sourceTree = "<group>"; };
\t\tA1WGTFR04FED796500168586 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
\t\tA1WGTFR05FED796500168587 /* DiabeatersWidget.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = DiabeatersWidget.entitlements; sourceTree = "<group>"; };
\t\tA1WGTPR01FED796500168590 /* DiabeatersWidgetExtension.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = DiabeatersWidgetExtension.appex; sourceTree = BUILT_PRODUCTS_DIR; };
\t\tA1WGTGRP1FED796500168591 /* DiabeatersWidget */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\tA1WGTFR01FED796500168580 /* DiabeatersWidgetBundle.swift */,
\t\t\t\tA1WGTFR02FED796500168581 /* DiabeatersStatusWidget.swift */,
\t\t\t\tA1WGTFR03FED796500168582 /* ExerciseLiveActivityWidget.swift */,
\t\t\t\tA1WGTFR04FED796500168586 /* Info.plist */,
\t\t\t\tA1WGTFR05FED796500168587 /* DiabeatersWidget.entitlements */,
\t\t\t);
\t\t\tpath = DiabeatersWidget;
\t\t\tsourceTree = "<group>";
\t\t};
\t\tA1WGTSRC1FED796500168592 /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tA1WGTBF01FED796500168580 /* DiabeatersWidgetBundle.swift in Sources */,
\t\t\t\tA1WGTBF02FED796500168581 /* DiabeatersStatusWidget.swift in Sources */,
\t\t\t\tA1WGTBF03FED796500168582 /* ExerciseLiveActivityWidget.swift in Sources */,
\t\t\t\tA1WGTBF04FED796500168583 /* DiabeatersSharedStatus.swift in Sources */,
\t\t\t\tA1WGTBF05FED796500168584 /* ExerciseLiveActivityAttributes.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WGTFRM1FED796500168593 /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WGTRES1FED796500168594 /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WGTEMB1FED796500168595 /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\tA1WGTBF06FED796500168585 /* DiabeatersWidgetExtension.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WGTTGT1FED796500168596 /* DiabeatersWidgetExtension */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = A1WGTCL01FED796500168597 /* Build configuration list for PBXNativeTarget "DiabeatersWidgetExtension" */;
\t\t\tbuildPhases = (
\t\t\t\tA1WGTSRC1FED796500168592 /* Sources */,
\t\t\t\tA1WGTFRM1FED796500168593 /* Frameworks */,
\t\t\t\tA1WGTRES1FED796500168594 /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = DiabeatersWidgetExtension;
\t\t\tproductName = DiabeatersWidgetExtension;
\t\t\tproductReference = A1WGTPR01FED796500168590 /* DiabeatersWidgetExtension.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
\t\tA1WGTDEP1FED796500168598 /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = A1WGTTGT1FED796500168596 /* DiabeatersWidgetExtension */;
\t\t\ttargetProxy = A1WGTPRX1FED796500168599 /* PBXContainerItemProxy */;
\t\t};
\t\tA1WGTPRX1FED796500168599 /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 504EC2FC1FED79650016851F /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = A1WGTTGT1FED796500168596;
\t\t\tremoteInfo = DiabeatersWidgetExtension;
\t\t};
\t\tA1WGTDBG1FED7965001685A0 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWidget/DiabeatersWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 16.2;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tA1WGTREL1FED7965001685A1 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWidget/DiabeatersWidget.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 16.2;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\tA1WGTCL01FED796500168597 /* Build configuration list for PBXNativeTarget "DiabeatersWidgetExtension" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\tA1WGTDBG1FED7965001685A0 /* Debug */,
\t\t\t\tA1WGTREL1FED7965001685A1 /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End DiabeatersWidget extension */
`,
  );

  ensureLineInBlock(
    "\t\t\t\t504EC3061FED79650016851F /* App */,\n",
    "\t\t\t\tA1WGTGRP1FED796500168591 /* DiabeatersWidget */,\n",
  );
  ensureLineInBlock(
    "\t\t\t\t504EC3041FED79650016851F /* App.app */,\n",
    "\t\t\t\tA1WGTPR01FED796500168590 /* DiabeatersWidgetExtension.appex */,\n",
  );
  pbx = pbx.replace(
    `targets = (
\t\t\t\t504EC3031FED79650016851F /* App */,
\t\t\t);`,
    `targets = (
\t\t\t\t504EC3031FED79650016851F /* App */,
\t\t\t\tA1WGTTGT1FED796500168596 /* DiabeatersWidgetExtension */,
\t\t\t);`,
  );
  pbx = pbx.replace(
    `buildPhases = (
\t\t\t\t504EC3001FED79650016851F /* Sources */,
\t\t\t\t504EC3011FED79650016851F /* Frameworks */,
\t\t\t\t504EC3021FED79650016851F /* Resources */,
\t\t\t);`,
    `buildPhases = (
\t\t\t\t504EC3001FED79650016851F /* Sources */,
\t\t\t\t504EC3011FED79650016851F /* Frameworks */,
\t\t\t\t504EC3021FED79650016851F /* Resources */,
\t\t\t\tA1WGTEMB1FED796500168595 /* Embed Foundation Extensions */,
\t\t\t);`,
  );
  pbx = pbx.replace(
    `dependencies = (
\t\t\t);
\t\t\tname = App;`,
    `dependencies = (
\t\t\t\tA1WGTDEP1FED796500168598 /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = App;`,
  );
  pbx = pbx.replace(
    `TargetAttributes = {
\t\t\t\t\t504EC3031FED79650016851F = {`,
    `TargetAttributes = {
\t\t\t\t\tA1WGTTGT1FED796500168596 = {
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};
\t\t\t\t\t504EC3031FED79650016851F = {`,
  );
}

writeFileSync(pbxPath, pbx);
console.log("✓ iOS project includes OsSurfaces + DiabeatersWidgetExtension");
