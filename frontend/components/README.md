# Components

This directory contains reusable React Native components.

## Organization

```
components/
├── common/       # Shared UI components (Button, Card, etc.)
├── listings/     # Listing-specific components
└── README.md     # This file
```

## Creating New Components

1. **One component per file**

   ```typescript
   // components/common/Button.tsx
   export function Button({ onPress, title }: ButtonProps) {
     // ...
   }
   ```

2. **Export from index.ts** for cleaner imports

   ```typescript
   // components/common/index.ts
   export { Button } from './Button';
   export { Card } from './Card';
   ```

3. **Use TypeScript** for all props
   ```typescript
   interface ButtonProps {
     onPress: () => void;
     title: string;
     variant?: 'primary' | 'secondary';
   }
   ```

## Example Component Structure

```typescript
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
}

export function Button({ onPress, title }: ButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f4e3d',
    padding: 16,
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
```

## Best Practices

- Keep components small and focused
- Extract complex logic into custom hooks
- Use `StyleSheet.create()` for styles
- Document complex components with JSDoc comments
