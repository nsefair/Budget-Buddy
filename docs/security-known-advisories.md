# Known dependency advisories

Last reviewed: 2026-08-27

`npm audit` currently reports eight high-severity entries and fourteen moderate
entries after applying every compatible non-breaking remediation. There are no
critical findings.

The high-severity entries form one build-tool dependency chain:

```text
expo 54.0.37
  -> @expo/cli / @expo/metro / @expo/metro-config
  -> metro 0.83.3
  -> image-size 1.2.1
```

The reported `image-size` denial-of-service issue affects Metro's development
and bundle-time image inspection. It is not imported by Budget Buddy's mobile
runtime or Go API. The npm-proposed remediation installs Expo 57, a breaking
major upgrade that also changes React Native and native project dependencies.

## Temporary policy

- CI blocks critical advisories and reports the full audit output.
- Dependabot monitors npm weekly.
- Development builds must not process untrusted image repositories or archives.
- The Expo 57 migration must be performed as a dedicated change with regenerated
  iOS/Android projects and physical-device checks for Plaid Link, notifications,
  image upload, navigation, and SecureStore session restoration.

This is a time-bounded exception, not a statement that high-severity findings
are harmless. Remove this exception when a tested compatible Expo release fixes
the dependency path.
