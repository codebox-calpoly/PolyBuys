import { StyleSheet, View, useWindowDimensions } from 'react-native';

const mapLines = [
  { key: 'v-campus-west', style: { left: '9%', top: 18, height: 540 } },
  { key: 'v-campus-core', style: { left: '31%', top: 0, height: 650 } },
  { key: 'v-market-walk', style: { left: '56%', top: 42, height: 610 } },
  { key: 'v-dorm-edge', style: { left: '82%', top: 8, height: 560 } },
] as const;

const mapRows = [
  { key: 'h-upper', style: { top: 104, left: '-6%', width: '112%' } },
  { key: 'h-center', style: { top: 252, left: '-4%', width: '108%' } },
  { key: 'h-lower', style: { top: 420, left: '-8%', width: '116%' } },
] as const;

const routeSegments = [
  {
    key: 'green-north',
    style: {
      left: '-8%',
      top: 168,
      width: 680,
      transform: [{ rotate: '8deg' }],
      backgroundColor: 'rgba(21, 71, 52, 0.17)',
    },
  },
  {
    key: 'green-south',
    style: {
      right: '-10%',
      top: 382,
      width: 700,
      transform: [{ rotate: '10deg' }],
      backgroundColor: 'rgba(21, 71, 52, 0.13)',
    },
  },
  {
    key: 'gold-cross',
    style: {
      left: '26%',
      top: 312,
      width: 720,
      transform: [{ rotate: '-24deg' }],
      backgroundColor: 'rgba(226, 168, 74, 0.17)',
    },
  },
] as const;

const accentDots = [
  { key: 'dot-market', style: { left: '31%', top: 246 }, color: '#154734', size: 10 },
  { key: 'dot-core', style: { left: '56%', top: 414 }, color: '#E2A84A', size: 12 },
  { key: 'dot-dorm', style: { left: '82%', top: 102 }, color: '#154734', size: 8 },
  { key: 'dot-book', style: { left: '68%', top: 294 }, color: '#E2A84A', size: 7 },
] as const;

const ghostCards = [
  {
    key: 'card-left',
    style: { left: '4%', top: 150, width: 168, height: 124, transform: [{ rotate: '-7deg' }] },
  },
  {
    key: 'card-right',
    style: { right: '5%', top: 230, width: 196, height: 142, transform: [{ rotate: '5deg' }] },
  },
  {
    key: 'card-bottom',
    style: { left: '14%', top: 500, width: 210, height: 148, transform: [{ rotate: '4deg' }] },
  },
] as const;

const decorativeAccessibilityProps = { 'aria-hidden': true } as const;

export function HomeBg() {
  const { width } = useWindowDimensions();
  const isCompact = width < 700;
  const focusSize = isCompact ? 780 : Math.min(Math.max(width * 0.82, 980), 1380);
  const ghostCardsToRender = isCompact ? ghostCards.slice(0, 1) : ghostCards;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...decorativeAccessibilityProps}
      style={styles.root}
    >
      <View style={styles.base} />
      <View style={styles.mintWash} />
      <View style={styles.topLightStrong} />
      <View style={styles.topLightSoft} />

      <View
        style={[
          styles.focusGlow,
          {
            width: focusSize,
            height: focusSize,
            borderRadius: focusSize / 2,
            marginLeft: -focusSize / 2,
          },
        ]}
      />
      <View
        style={[
          styles.focusGlowInner,
          {
            width: focusSize * 0.58,
            height: focusSize * 0.58,
            borderRadius: (focusSize * 0.58) / 2,
            marginLeft: -(focusSize * 0.58) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.focusGlowWarm,
          {
            width: focusSize * 0.34,
            height: focusSize * 0.34,
            borderRadius: (focusSize * 0.34) / 2,
            marginLeft: -(focusSize * 0.34) / 2,
          },
        ]}
      />

      <View style={[styles.mapLayer, isCompact && styles.mapLayerCompact]}>
        {mapLines.map((line) => (
          <View key={line.key} style={[styles.gridLineVertical, line.style]} />
        ))}
        {mapRows.map((line) => (
          <View key={line.key} style={[styles.gridLineHorizontal, line.style]} />
        ))}
        {routeSegments.map((segment) => (
          <View key={segment.key} style={[styles.routeSegment, segment.style]} />
        ))}
        {accentDots.map((dot) => (
          <View
            key={dot.key}
            style={[
              styles.accentDot,
              dot.style,
              {
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2,
                backgroundColor: dot.color,
              },
            ]}
          />
        ))}
      </View>

      {ghostCardsToRender.map((card) => (
        <View key={card.key} style={[styles.ghostCard, card.style]}>
          <View style={styles.ghostImage} />
          <View style={styles.ghostLineWide} />
          <View style={styles.ghostLineShort} />
        </View>
      ))}

      <View style={styles.gridCalmWash} />
      <View style={styles.edgeShadeLeft} />
      <View style={styles.edgeShadeRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F5EF',
  },
  mintWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 210,
    bottom: 0,
    backgroundColor: '#EAF3EE',
    opacity: 0.72,
  },
  topLightStrong: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 92,
    backgroundColor: '#FFFFFF',
    opacity: 0.42,
  },
  topLightSoft: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 70,
    height: 220,
    backgroundColor: '#FFF8E8',
    opacity: 0.34,
  },
  focusGlow: {
    position: 'absolute',
    left: '50%',
    top: 168,
    backgroundColor: '#ACDDCA',
    opacity: 0.14,
  },
  focusGlowInner: {
    position: 'absolute',
    left: '50%',
    top: 262,
    backgroundColor: '#FFFFFF',
    opacity: 0.11,
  },
  focusGlowWarm: {
    position: 'absolute',
    left: '50%',
    top: 358,
    backgroundColor: '#E2A84A',
    opacity: 0.075,
  },
  mapLayer: {
    position: 'absolute',
    left: '-4%',
    right: '-4%',
    top: 64,
    height: 660,
    opacity: 0.76,
  },
  mapLayerCompact: {
    left: '-42%',
    right: '-42%',
    top: 110,
    height: 540,
    opacity: 0.54,
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(21, 71, 52, 0.12)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(21, 71, 52, 0.11)',
  },
  routeSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    opacity: 0.44,
  },
  accentDot: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(247, 245, 239, 0.88)',
    opacity: 0.68,
  },
  ghostCard: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.10)',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    opacity: 0.24,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  ghostImage: {
    height: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(21, 71, 52, 0.09)',
    marginBottom: 12,
  },
  ghostLineWide: {
    width: '72%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(21, 71, 52, 0.10)',
    marginBottom: 8,
  },
  ghostLineShort: {
    width: '44%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(226, 168, 74, 0.15)',
  },
  gridCalmWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 280,
    bottom: 0,
    backgroundColor: '#F7F5EF',
    opacity: 0.62,
  },
  edgeShadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(21, 71, 52, 0.025)',
  },
  edgeShadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(21, 71, 52, 0.025)',
  },
});
