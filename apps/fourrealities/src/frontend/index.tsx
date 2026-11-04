/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Delivery Integrity UI Kit Frontend (entry point)
 */

import React from 'react';
import ForgeReconciler from '@forge/react';
import { FourRealitiesApp } from './app';

export { FourRealitiesApp };
export default FourRealitiesApp;

ForgeReconciler.render(
  <React.StrictMode>
    <FourRealitiesApp />
  </React.StrictMode>
);
