# Dependency Update Notes

## Current Status (Dec 2025)

### Updated ✅

- `@typescript-eslint/eslint-plugin`: ^7.18.0 → ^8.17.0
- `@typescript-eslint/parser`: ^7.18.0 → ^8.17.0
- `prettier`: ^3.3.3 → ^3.4.2
- `eslint-plugin-react-hooks`: ^4.6.2 → ^5.1.0
- Added explicit Babel transform plugins to frontend to replace deprecated proposal plugins

### Cannot Update Yet ⚠️

#### ESLint 8 → 9

**Reason**: `eslint-plugin-react-native@4.1.0` only supports ESLint 8.x
**Status**: Waiting for upstream update
**Tracking**: https://github.com/Intellicode/eslint-plugin-react-native/issues
**Workaround**: ESLint 8.57.1 is still functional and receives security updates

#### Remaining Deprecation Warnings

These come from deep dependencies in Expo and ESLint ecosystem:

- `inflight@1.0.6` - Used by glob@7 (Expo dependency)
- `@babel/plugin-proposal-*` - Expo Metro bundler dependencies
- `rimraf@2.6.3, rimraf@3.0.2` - Various tool dependencies
- `glob@7.2.3` - Node ecosystem transition to glob@9+
- `@humanwhocodes/*` - ESLint 8 dependencies (fixed in ESLint 9)
- `@xmldom/xmldom@0.7.13` - Expo dependency

**Impact**: None on functionality. These are informational warnings.
**Action**: Will be resolved automatically when:

1. Expo updates to newer Babel/Metro versions
2. eslint-plugin-react-native adds ESLint 9 support
3. We can migrate to ESLint 9

## Next Update Window

- Check quarterly for `eslint-plugin-react-native` ESLint 9 support
- Expo SDK 53+ may include updated Metro/Babel dependencies
- Monitor GitHub issues for upstream progress

## Update Commands

```bash
# Check for updates
npm outdated

# Update within semver ranges
npm update

# Check for major updates
npx npm-check-updates
```

## References

- [ESLint Version Support](https://eslint.org/version-support)
- [Expo SDK Changelog](https://expo.dev/changelog)
- [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
