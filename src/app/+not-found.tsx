import React from 'react';import {router} from 'expo-router';import {Page,T,Button} from '../components/ui';
export default function NotFound(){return <Page><T size={24} bold>This page is unavailable</T><T>Open Today to continue with your saved drinks.</T><Button title="Go to Today" onPress={()=>router.replace('/')}/></Page>;}

export { ErrorBoundary } from "../components/route-error";
