import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const commonStackOptions: NativeStackNavigationOptions = {
  // Keep heights consistent by using the same settings everywhere:
  headerLargeTitle: false, // or true everywhere if you prefer large titles on iOS
  headerTitleAlign: 'left',
  headerTitleStyle: { fontSize: 30, fontWeight: 'bold' },
  headerStyle: { backgroundColor: '#102E5C' },
  headerTintColor: '#fff',
  headerShadowVisible: true,
  // Keep the back chevron visible but hide the text label for a cleaner look.
  // Use an empty back title and prefer the minimal display mode (icon only) on iOS/web.
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: '#f0fff4ff' },
};


/*
Old headerStyle for reference:
headerStyle: {
          backgroundColor: '#002E5D',
          height: 120,
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 36,
        },
*/