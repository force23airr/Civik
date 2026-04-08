import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleRegister = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (form.password !== form.confirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      Alert.alert('Weak Password', 'Password must contain uppercase, lowercase, and a number.');
      return;
    }

    setLoading(true);
    try {
      await register(form.username.trim(), form.email.trim().toLowerCase(), form.password);
      router.replace('/(tabs)');
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      Alert.alert(
        'Registration Failed',
        serverMsg || 'Could not create account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Ionicons name="car-sport" size={48} color="#3b82f6" />
            <Text style={styles.brand}>Civik</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start reporting violations and earning rewards</Text>

            {[
              { key: 'username', label: 'Username', placeholder: 'johndoe', keyboard: 'default' },
              { key: 'email', label: 'Email', placeholder: 'your@email.com', keyboard: 'email-address' },
              { key: 'password', label: 'Password', placeholder: '••••••••', secure: true },
              { key: 'confirm', label: 'Confirm Password', placeholder: '••••••••', secure: true }
            ].map(field => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor="#475569"
                  value={form[field.key]}
                  onChangeText={set(field.key)}
                  secureTextEntry={field.secure}
                  keyboardType={field.keyboard || 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Account</Text>}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" style={styles.footerLink}>Sign In</Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 8 },
  card: {
    backgroundColor: 'rgba(30,41,59,0.9)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 13,
    color: '#e2e8f0',
    fontSize: 15
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 8
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#64748b', fontSize: 14 },
  footerLink: { color: '#3b82f6', fontWeight: '600', fontSize: 14 }
});
