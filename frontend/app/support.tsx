import { Redirect, type Href } from 'expo-router';

export default function SupportRoute() {
  return <Redirect href={'/home' as Href} />;
}
