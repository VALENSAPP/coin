import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, ScrollView, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const PICKUP_CITY_OPTIONS = [
  'Los Angeles, CA',
  'New York, NY',
  'San Francisco, CA',
  'Chicago, IL',
  'Austin, TX',
];

export const PICKUP_LOCATIONS_BY_CITY = {
  'Los Angeles, CA': [
    { label: 'Westwood Village', address: '108 Westwood Blvd, Los Angeles, CA 90024' },
    { label: 'Downtown LA', address: '350 S Grand Ave, Los Angeles, CA 90071' },
  ],
  'New York, NY': [
    { label: 'Union Square', address: '4 Union Square S, New York, NY 10003' },
    { label: 'Williamsburg', address: '221 Bedford Ave, Brooklyn, NY 11249' },
  ],
  'San Francisco, CA': [
    { label: 'Hayes Valley', address: '388 Hayes St, San Francisco, CA 94102' },
  ],
  'Chicago, IL': [
    { label: 'Wicker Park', address: '1500 N Milwaukee Ave, Chicago, IL 60622' },
  ],
  'Austin, TX': [
    { label: 'South Congress', address: '1600 S Congress Ave, Austin, TX 78704' },
  ],
};

export const PICKUP_TIME_OPTIONS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM',
];

export const DEFAULT_PICKUP_HOURS = {
  weekdayStart: '10:00 AM',
  weekdayEnd: '6:00 PM',
  weekendStart: '11:00 AM',
  weekendEnd: '4:00 PM',
};

export const getOptionValue = option =>
  typeof option === 'string' ? option : option?.value;

export const getOptionLabel = option =>
  typeof option === 'string' ? option : option?.label || option?.value || '';

export const withAlpha = (hex, alpha = 0.12) => {
  if (!hex) return 'transparent';
  let hexCode = hex.replace('#', '');
  if (hexCode.length === 3) {
    hexCode = hexCode.split('').map(c => c + c).join('');
  }
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${hexCode}${a}`;
};

export const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
      <Ionicons name="alert-circle" size={14} color="#dc2626" />
      <Text style={{ color: '#dc2626', fontSize: 12, marginLeft: 4 }}>{message}</Text>
    </View>
  );
};

export const ToggleSwitch = ({ value, onValueChange, accent }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => onValueChange(!value)}
    style={[
      styles.toggleTrack,
      { backgroundColor: value ? accent : '#e5e7eb' },
    ]}
  >
    <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
  </TouchableOpacity>
);

export const AdvancedDropdownRow = ({
  label,
  placeholder,
  value,
  expanded,
  onToggle,
  onSelect,
  options,
  text,
  error,
}) => {
  const selectedOption = options.find(item => getOptionValue(item) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[
          styles.dropdownRow,
          expanded && styles.dropdownRowActive,
          { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
        ]}
      >
        <Text style={[styles.dropdownText, !value && { color: '#a1a1aa' }]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={text}
        />
      </TouchableOpacity>
      {expanded ? (
        <ScrollView
          style={styles.dropdownList}
          contentContainerStyle={styles.dropdownListContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          persistentScrollbar
          keyboardShouldPersistTaps="handled"
        >
          {options.map((item, index) => {
            const itemValue = getOptionValue(item);
            const itemLabel = getOptionLabel(item);
            const selected = value === itemValue;
            return (
              <TouchableOpacity
                key={itemValue || itemLabel || index}
                activeOpacity={0.8}
                onPress={() => onSelect(itemValue)}
                style={[
                  styles.dropdownItem,
                  index !== options.length - 1 && styles.dropdownItemBorder,
                  selected && styles.dropdownItemSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selected && styles.dropdownItemTextSelected,
                  ]}
                >
                  {itemLabel}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={16} color="#4f46e5" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      <InlineError message={error} />
    </View>
  );
};

export const PlaceFieldRow = ({
  icon,
  label,
  placeholder,
  value,
  filled,
  loading,
  expanded,
  disabled,
  onToggle,
  onCollapse,
  text,
  error,
  query,
  onQueryChange,
  predictions,
  searching,
  onSelectPrediction,
  t,
}) => (
  <View style={styles.placeFieldBlock}>
    <View style={styles.placeFieldTopRow}>
      <View style={styles.placeFieldIconWrap}>
        <Ionicons name={icon} size={17} color="#5A2386" />
      </View>
      <Text style={styles.placeFieldLabel} numberOfLines={1}>
        {label}
      </Text>

      {expanded ? (
        <View
          style={[
            styles.placeFieldValueBox,
            styles.placeFieldValueBoxActive,
            { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
          ]}
        >
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('myClosetShared.searchPlaceholder', { label: label.toLowerCase() }) || 'Search...'}
            placeholderTextColor="#a1a1aa"
            autoFocus
            style={styles.placeFieldSearchInline}
          />
          <TouchableOpacity onPress={onCollapse} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-up" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={disabled ? undefined : onToggle}
          style={[
            styles.placeFieldValueBox,
            disabled && styles.placeFieldValueBoxDisabled,
            { borderColor: error ? '#dc2626' : withAlpha(text, 0.16) },
          ]}
        >
          <Text
            style={[styles.placeFieldValueText, !value && { color: '#a1a1aa' }]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#6b7280" />
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="small" color={text} style={styles.placeFieldCheck} />
      ) : filled && !expanded ? (
        <View style={styles.placeFieldCheck}>
          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
        </View>
      ) : (
        <View style={styles.placeFieldCheck} />
      )}
    </View>

    {expanded ? (
      <View style={styles.placeFieldPredictionsBox}>
        {searching ? (
          <View style={styles.placeFieldSearchingRow}>
            <ActivityIndicator size="small" color="#5A2386" />
          </View>
        ) : null}
        {predictions.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            onPress={() => onSelectPrediction(item)}
            style={[
              styles.dropdownItem,
              index !== predictions.length - 1 && styles.dropdownItemBorder,
            ]}
          >
            <Text style={styles.dropdownItemText} numberOfLines={2}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}
        {!searching && query.trim().length >= 2 && predictions.length === 0 ? (
          <Text style={styles.placeFieldNoResults}>{t('myClosetShared.noMatchesFound') || 'No matches found.'}</Text>
        ) : null}
      </View>
    ) : null}

    <InlineError message={error} />
  </View>
);

const styles = StyleSheet.create({
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },
  placeFieldBlock: {
    marginBottom: 14,
  },
  placeFieldTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeFieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  placeFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginRight: 8,
  },
  placeFieldValueBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  placeFieldValueBoxDisabled: {
    opacity: 0.5,
  },
  placeFieldValueBoxActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  placeFieldValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  placeFieldCheck: {
    width: 26,
    marginLeft: 8,
    alignItems: 'center',
  },
  placeFieldSearchInline: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#111827',
  },
  placeFieldPredictionsBox: {
    marginLeft: 44,
    marginTop: -1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingVertical: 4,
  },
  placeFieldSearchingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  placeFieldNoResults: {
    padding: 14,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  dropdownRow: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownRowActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
    marginRight: 10,
  },
  dropdownList: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  dropdownListContent: {
    flexGrow: 0,
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemSelected: {
    backgroundColor: '#f5f3ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  dropdownItemTextSelected: {
    color: '#4f46e5',
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});
