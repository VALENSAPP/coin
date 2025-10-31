// src/textGradient.js
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

const TextGradient = ({
  text,
  colors,
  locations,
  start,
  end,
  style,
}) => {
  const fontSize = style?.fontSize || 20;
  const fontWeight = style?.fontWeight || "normal";

  // Estimate width based on font size and text length
  const textWidth = text.length * (fontSize * 0.7) + 10;
  const textHeight = fontSize * 1.2;

  return (
    <View>
      <Svg height={textHeight} width={textWidth}>
        <Defs>
          <LinearGradient
            id="gradient"
            x1={start?.x || 0}
            y1={start?.y || 0}
            x2={end?.x || 1}
            y2={end?.y || 0}
          >
            {colors.map((color, index) => (
              <Stop
                key={index}
                offset={locations ? locations[index] : index / (colors.length - 1)}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <SvgText
          fill="url(#gradient)"
          fontSize={fontSize}
          fontWeight={fontWeight}
          x={0}
          y={fontSize} // ensures baseline is visible
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
};

export default TextGradient;
