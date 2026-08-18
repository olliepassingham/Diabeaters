#!/usr/bin/env node
/**
 * Ensures the watchOS companion (DiabeatersWatch + complications) is wired into
 * App.xcodeproj after Capacitor rewrites the project. Idempotent.
 * Run after scripts/ensure-ios-widget-target.mjs.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const pbxPath = join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
if (!existsSync(pbxPath)) {
  console.error(`Missing ${pbxPath}`);
  process.exit(1);
}

const iconSrc = join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "app_icon_1024.png");
const iconDst = join(
  root,
  "ios",
  "App",
  "DiabeatersWatch",
  "Assets.xcassets",
  "AppIcon.appiconset",
  "app_icon_1024.png",
);
if (existsSync(iconSrc)) {
  mkdirSync(dirname(iconDst), { recursive: true });
  copyFileSync(iconSrc, iconDst);
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

if (!pbx.includes("DiabeatersWatch")) {
  insertBefore(
    "/* Begin PBXProject section */",
    `
/* Begin DiabeatersWatch companion */
\t\tA1WCHBF10FED796500168610 /* DiabeatersWatchApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WCHFR10FED796500168610 /* DiabeatersWatchApp.swift */; };
\t\tA1WCHBF11FED796500168611 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WCHFR11FED796500168611 /* ContentView.swift */; };
\t\tA1WCHBF12FED796500168612 /* WatchStatusStore.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WCHFR12FED796500168612 /* WatchStatusStore.swift */; };
\t\tA1WCHBF13FED796500168613 /* DiabeatersSharedStatus.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */; };
\t\tA1WCHBF14FED796500168614 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A1WCHFR15FED796500168615 /* Assets.xcassets */; };
\t\tA1WCHBF15FED796500168615 /* DiabeatersWatch.app in Embed Watch Content */ = {isa = PBXBuildFile; fileRef = A1WCHPR10FED796500168616 /* DiabeatersWatch.app */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
\t\tA1WCHBF16FED796500168616 /* DiabeatersWatchWidgets.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = A1WCHPR20FED796500168634 /* DiabeatersWatchWidgets.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
\t\tA1WCHBF17FED796500168623 /* WatchConnectivity.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = A1WCHFR01FED796500168601 /* WatchConnectivity.framework */; };
\t\tA1WCHBF20FED796500168630 /* DiabeatersWatchWidgets.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1WCHFR20FED796500168630 /* DiabeatersWatchWidgets.swift */; };
\t\tA1WCHBF21FED796500168631 /* DiabeatersSharedStatus.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1SHARE00FED796500168571 /* DiabeatersSharedStatus.swift */; };
\t\tA1WCHFR10FED796500168610 /* DiabeatersWatchApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiabeatersWatchApp.swift; sourceTree = "<group>"; };
\t\tA1WCHFR11FED796500168611 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
\t\tA1WCHFR12FED796500168612 /* WatchStatusStore.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = WatchStatusStore.swift; sourceTree = "<group>"; };
\t\tA1WCHFR13FED796500168613 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
\t\tA1WCHFR14FED796500168614 /* DiabeatersWatch.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = DiabeatersWatch.entitlements; sourceTree = "<group>"; };
\t\tA1WCHFR15FED796500168615 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
\t\tA1WCHPR10FED796500168616 /* DiabeatersWatch.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = DiabeatersWatch.app; sourceTree = BUILT_PRODUCTS_DIR; };
\t\tA1WCHFR20FED796500168630 /* DiabeatersWatchWidgets.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiabeatersWatchWidgets.swift; sourceTree = "<group>"; };
\t\tA1WCHFR21FED796500168632 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
\t\tA1WCHFR22FED796500168633 /* DiabeatersWatchWidgets.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = DiabeatersWatchWidgets.entitlements; sourceTree = "<group>"; };
\t\tA1WCHPR20FED796500168634 /* DiabeatersWatchWidgets.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = DiabeatersWatchWidgets.appex; sourceTree = BUILT_PRODUCTS_DIR; };
\t\tA1WCHGRP1FED796500168617 /* DiabeatersWatch */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\tA1WCHFR10FED796500168610 /* DiabeatersWatchApp.swift */,
\t\t\t\tA1WCHFR11FED796500168611 /* ContentView.swift */,
\t\t\t\tA1WCHFR12FED796500168612 /* WatchStatusStore.swift */,
\t\t\t\tA1WCHFR13FED796500168613 /* Info.plist */,
\t\t\t\tA1WCHFR14FED796500168614 /* DiabeatersWatch.entitlements */,
\t\t\t\tA1WCHFR15FED796500168615 /* Assets.xcassets */,
\t\t\t);
\t\t\tpath = DiabeatersWatch;
\t\t\tsourceTree = "<group>";
\t\t};
\t\tA1WCHGRP2FED796500168635 /* DiabeatersWatchWidgets */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\tA1WCHFR20FED796500168630 /* DiabeatersWatchWidgets.swift */,
\t\t\t\tA1WCHFR21FED796500168632 /* Info.plist */,
\t\t\t\tA1WCHFR22FED796500168633 /* DiabeatersWatchWidgets.entitlements */,
\t\t\t);
\t\t\tpath = DiabeatersWatchWidgets;
\t\t\tsourceTree = "<group>";
\t\t};
\t\tA1WCHSRC1FED796500168618 /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tA1WCHBF10FED796500168610 /* DiabeatersWatchApp.swift in Sources */,
\t\t\t\tA1WCHBF11FED796500168611 /* ContentView.swift in Sources */,
\t\t\t\tA1WCHBF12FED796500168612 /* WatchStatusStore.swift in Sources */,
\t\t\t\tA1WCHBF13FED796500168613 /* DiabeatersSharedStatus.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHFRM1FED796500168619 /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tA1WCHBF17FED796500168623 /* WatchConnectivity.framework in Frameworks */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHRES1FED79650016861A /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tA1WCHBF14FED796500168614 /* Assets.xcassets in Resources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHEMB1FED79650016861B /* Embed Watch Content */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "$(CONTENTS_FOLDER_PATH)/Watch";
\t\t\tdstSubfolderSpec = 16;
\t\t\tfiles = (
\t\t\t\tA1WCHBF15FED796500168615 /* DiabeatersWatch.app in Embed Watch Content */,
\t\t\t);
\t\t\tname = "Embed Watch Content";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHEMB2FED79650016861C /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\tA1WCHBF16FED796500168616 /* DiabeatersWatchWidgets.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHSRC2FED796500168636 /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tA1WCHBF20FED796500168630 /* DiabeatersWatchWidgets.swift in Sources */,
\t\t\t\tA1WCHBF21FED796500168631 /* DiabeatersSharedStatus.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHFRM2FED796500168637 /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHRES2FED796500168638 /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
\t\tA1WCHTGT1FED79650016861D /* DiabeatersWatch */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = A1WCHCL01FED796500168622 /* Build configuration list for PBXNativeTarget "DiabeatersWatch" */;
\t\t\tbuildPhases = (
\t\t\t\tA1WCHSRC1FED796500168618 /* Sources */,
\t\t\t\tA1WCHFRM1FED796500168619 /* Frameworks */,
\t\t\t\tA1WCHRES1FED79650016861A /* Resources */,
\t\t\t\tA1WCHEMB2FED79650016861C /* Embed Foundation Extensions */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t\tA1WCHDEP2FED79650016863A /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = DiabeatersWatch;
\t\t\tproductName = DiabeatersWatch;
\t\t\tproductReference = A1WCHPR10FED796500168616 /* DiabeatersWatch.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t};
\t\tA1WCHTGT2FED796500168639 /* DiabeatersWatchWidgets */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = A1WCHCL02FED79650016863E /* Build configuration list for PBXNativeTarget "DiabeatersWatchWidgets" */;
\t\t\tbuildPhases = (
\t\t\t\tA1WCHSRC2FED796500168636 /* Sources */,
\t\t\t\tA1WCHFRM2FED796500168637 /* Frameworks */,
\t\t\t\tA1WCHRES2FED796500168638 /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = DiabeatersWatchWidgets;
\t\t\tproductName = DiabeatersWatchWidgets;
\t\t\tproductReference = A1WCHPR20FED796500168634 /* DiabeatersWatchWidgets.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
\t\tA1WCHDEP1FED79650016861E /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = A1WCHTGT1FED79650016861D /* DiabeatersWatch */;
\t\t\ttargetProxy = A1WCHPRX1FED79650016861F /* PBXContainerItemProxy */;
\t\t};
\t\tA1WCHPRX1FED79650016861F /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 504EC2FC1FED79650016851F /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = A1WCHTGT1FED79650016861D;
\t\t\tremoteInfo = DiabeatersWatch;
\t\t};
\t\tA1WCHDEP2FED79650016863A /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = A1WCHTGT2FED796500168639 /* DiabeatersWatchWidgets */;
\t\t\ttargetProxy = A1WCHPRX2FED79650016863B /* PBXContainerItemProxy */;
\t\t};
\t\tA1WCHPRX2FED79650016863B /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 504EC2FC1FED79650016851F /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = A1WCHTGT2FED796500168639;
\t\t\tremoteInfo = DiabeatersWatchWidgets;
\t\t};
\t\tA1WCHDBG1FED796500168620 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWatch/DiabeatersWatch.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWatch/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.watchkitapp;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = watchos;
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSUPPORTED_PLATFORMS = "watchos watchsimulator";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 4;
\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tA1WCHREL1FED796500168621 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWatch/DiabeatersWatch.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWatch/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.watchkitapp;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = watchos;
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSUPPORTED_PLATFORMS = "watchos watchsimulator";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 4;
\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\tA1WCHCL01FED796500168622 /* Build configuration list for PBXNativeTarget "DiabeatersWatch" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\tA1WCHDBG1FED796500168620 /* Debug */,
\t\t\t\tA1WCHREL1FED796500168621 /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
\t\tA1WCHDBG2FED79650016863C /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tAPPLICATION_EXTENSION_API_ONLY = YES;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWatchWidgets/DiabeatersWatchWidgets.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWatchWidgets/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.watchkitapp.widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = watchos;
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSUPPORTED_PLATFORMS = "watchos watchsimulator";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 4;
\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tA1WCHREL2FED79650016863D /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tAPPLICATION_EXTENSION_API_ONLY = YES;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = DiabeatersWatchWidgets/DiabeatersWatchWidgets.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 39;
\t\t\t\tDEVELOPMENT_TEAM = Q9528Z889A;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = DiabeatersWatchWidgets/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0.39;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.passingtime.diabeaters.watchkitapp.widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = watchos;
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSUPPORTED_PLATFORMS = "watchos watchsimulator";
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 4;
\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\tA1WCHCL02FED79650016863E /* Build configuration list for PBXNativeTarget "DiabeatersWatchWidgets" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\tA1WCHDBG2FED79650016863C /* Debug */,
\t\t\t\tA1WCHREL2FED79650016863D /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End DiabeatersWatch companion */
`,
  );

  ensureLineInBlock(
    "\t\t\t\tA1WGTGRP1FED796500168591 /* DiabeatersWidget */,\n",
    `\t\t\t\tA1WCHGRP1FED796500168617 /* DiabeatersWatch */,
\t\t\t\tA1WCHGRP2FED796500168635 /* DiabeatersWatchWidgets */,
`,
  );
  ensureLineInBlock(
    "\t\t\t\tA1WGTPR01FED796500168590 /* DiabeatersWidgetExtension.appex */,\n",
    `\t\t\t\tA1WCHPR10FED796500168616 /* DiabeatersWatch.app */,
\t\t\t\tA1WCHPR20FED796500168634 /* DiabeatersWatchWidgets.appex */,
`,
  );

  pbx = pbx.replace(
    `\t\t\t\tA1WGTTGT1FED796500168596 /* DiabeatersWidgetExtension */,
\t\t\t);`,
    `\t\t\t\tA1WGTTGT1FED796500168596 /* DiabeatersWidgetExtension */,
\t\t\t\tA1WCHTGT1FED79650016861D /* DiabeatersWatch */,
\t\t\t\tA1WCHTGT2FED796500168639 /* DiabeatersWatchWidgets */,
\t\t\t);`,
  );

  pbx = pbx.replace(
    `\t\t\t\tA1WGTEMB1FED796500168595 /* Embed Foundation Extensions */,
\t\t\t);`,
    `\t\t\t\tA1WGTEMB1FED796500168595 /* Embed Foundation Extensions */,
\t\t\t\tA1WCHEMB1FED79650016861B /* Embed Watch Content */,
\t\t\t);`,
  );

  pbx = pbx.replace(
    `\t\t\t\tA1WGTDEP1FED796500168598 /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = App;`,
    `\t\t\t\tA1WGTDEP1FED796500168598 /* PBXTargetDependency */,
\t\t\t\tA1WCHDEP1FED79650016861E /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = App;`,
  );

  pbx = pbx.replace(
    `\t\t\t\t\tA1WGTTGT1FED796500168596 = {
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};`,
    `\t\t\t\t\tA1WGTTGT1FED796500168596 = {
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};
\t\t\t\t\tA1WCHTGT1FED79650016861D = {
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};
\t\t\t\t\tA1WCHTGT2FED796500168639 = {
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};`,
  );
}

writeFileSync(pbxPath, pbx);
console.log("✓ iOS project includes DiabeatersWatch + complications");
