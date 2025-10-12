import React, { useEffect, useState } from 'react';
import { Button, FlatList, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  createSterilizer,
  subscribeSterilizers,
  updateSterilizer
} from '../../src/features/sterilizer/sterilizer.store';

export default function SterilizerScreen() {
  const { user } = useAuth();
  const [label, setLabel] = useState('Unit A');
  const [pass, setPass] = useState(true);
  const [indicator, setIndicator] = useState<number>(0);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeSterilizers(setItems);
    return () => unsub();
  }, []);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '600' }}>Create a sterilizer record</Text>

      <TextInput value={label} onChangeText={setLabel} placeholder="Label" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text>Pass</Text>
        <Switch value={pass} onValueChange={setPass} />
      </View>
      <TextInput
        value={String(indicator)}
        onChangeText={(v) => setIndicator(Number(v) || 0)}
        keyboardType="number-pad"
        placeholder="Indicator (number)"
      />
      <Button title="Create" onPress={() => createSterilizer(indicator)} />

      <Text style={{ marginTop: 16, fontWeight: '600' }}>All records (shared)</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8 }}>
            <Text>{item.label} — active: {String(item.active)} — cycles: {item.cycles}</Text>
            <Button
              title={item.active ? 'Deactivate' : 'Activate'}
              onPress={() => updateSterilizer(item.id, { pass: !item.active })}
            />
            <Button
              title="Add 1 cycle"
              onPress={() => updateSterilizer(item.id, { indicator: Number(item.cycles ?? 0) + 1 })}
            />
            <Button
              title="Rename to 'Updated'"
              onPress={() => updateSterilizer(item.id, { label: 'Updated' })}
            />
          </View>
        )}
      />
    </View>
  );
}