import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Line, G } from 'react-native-svg';
import { C } from '../constants/theme';

export default function BarChartSVG({ data = [], midline = false, height = 80, color = C.cyan }) {
  if (!data.length) return <View style={[s.container, { height }]} />;

  const W = 360;
  const H = height;
  const maxVal = Math.max(...data.map(Math.abs), 1);
  const barW = Math.max(2, (W / data.length) - 1);

  return (
    <View style={[s.container, { height: H }]}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {midline && (
          <Line
            x1={0} y1={H / 2} x2={W} y2={H / 2}
            stroke={C.sep} strokeWidth={1}
          />
        )}
        {data.map((v, i) => {
          const x = i * (W / data.length);
          if (midline) {
            const barH = Math.abs(v) / maxVal * (H / 2 - 4);
            const y = v >= 0 ? H / 2 - barH : H / 2;
            return (
              <Rect
                key={i} x={x} y={y}
                width={barW} height={barH}
                fill={v >= 0 ? C.cyan : C.neg}
                opacity={0.85}
              />
            );
          } else {
            const barH = Math.max(2, Math.abs(v) / maxVal * (H - 8));
            return (
              <Rect
                key={i} x={x} y={H - barH}
                width={barW} height={barH}
                fill={color}
                opacity={0.85}
              />
            );
          }
        })}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: C.cardAlt,
    overflow: 'hidden',
  },
});
