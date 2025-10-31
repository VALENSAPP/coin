import React, { useRef, useState, useEffect } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  ClipPath,
  Polygon,
  Image as SvgImage,
  Circle,
} from 'react-native-svg';

const HexAvatar = ({
  uri,
  isUser = false,
  size = 75,
  borderWidth = 2,
  borderColor = '#000',
  hasUnseenStory = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const w = size, h = size;

  // Hexagon points
  const hexRadius = w / 2;
  const centerX = w / 2;
  const centerY = h / 2;
  const points = [
    `${centerX + hexRadius * Math.cos(0)},${centerY + hexRadius * Math.sin(0)}`,
    `${centerX + hexRadius * Math.cos(Math.PI / 3)},${centerY + hexRadius * Math.sin(Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(2 * Math.PI / 3)},${centerY + hexRadius * Math.sin(2 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(Math.PI)},${centerY + hexRadius * Math.sin(Math.PI)}`,
    `${centerX + hexRadius * Math.cos(4 * Math.PI / 3)},${centerY + hexRadius * Math.sin(4 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(5 * Math.PI / 3)},${centerY + hexRadius * Math.sin(5 * Math.PI / 3)}`,
  ].join(' ');

  const ids = useRef({
    clip: `hexClip-${size}-${Math.random().toString(36).slice(2)}`,
  }).current;

  // Validate URI and provide fallback
  const imageUri = uri && typeof uri === 'string' && uri.trim() !== '' ? uri.trim() : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

  // Reset image error state when URI changes
  useEffect(() => {
    setImageError(false);
  }, [uri]);

  return (
    <View style={{ padding: 2 }}>
      <Svg width={w} height={h}>
        <Defs>
          <ClipPath id={ids.clip}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>

        {!imageError ? (
          <SvgImage
            key={imageUri}
            href={{ uri: imageUri }}
            x={0}
            y={0}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${ids.clip})`}
            onError={() => {
              try { console.warn('HexAvatar image load error for URI:', imageUri); } catch (_) {}
              setImageError(true);
            }}
          />
        ) : (
          <Circle
            cx={centerX}
            cy={centerY}
            r={hexRadius - borderWidth}
            fill="#e0e0e0"
            clipPath={`url(#${ids.clip})`}
          />
        )}

        {borderWidth > 0 && (
          <Polygon
            points={points}
            stroke={borderColor || '#000'}
            strokeWidth={borderWidth}
            fill="transparent"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
};

export default HexAvatar;
