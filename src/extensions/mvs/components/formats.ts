/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { DataFormatProvider } from '../../../mol-plugin-state/formats/provider';
import { PluginStateObject as SO } from '../../../mol-plugin-state/objects';
import { Download } from '../../../mol-plugin-state/transforms/data';
import { PluginContext } from '../../../mol-plugin/context';
import { StateAction, StateObjectRef } from '../../../mol-state';
import { Task } from '../../../mol-task';
import { Asset } from '../../../mol-util/assets';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { loadMVS } from '../load';
import { MVSData } from '../mvs-data';
import { MVSTransform } from './annotation-structure-component';


/** Plugin state object storing `MVSData` */
export class Mvs extends SO.Create<{ mvsData: MVSData, sourceUrl?: string }>({ name: 'MVS Data', typeClass: 'Data' }) { }

/** Transformer for parsing data in MVSJ format */
export const ParseMVSJ = MVSTransform({
    name: 'mvs-parse-mvsj',
    display: { name: 'MVS Annotation Component', description: 'A molecular structure component defined by MVS annotation data.' },
    from: SO.Data.String,
    to: Mvs,
})({
    apply({ a }, plugin: PluginContext) {
        const mvsData = MVSData.fromMVSJ(a.data);
        const sourceUrl = tryGetDownloadUrl(a, plugin);
        return new Mvs({ mvsData, sourceUrl });
    },
});

/** If the PluginStateObject `pso` comes from a Download transform, try to get its `url` parameter. */
function tryGetDownloadUrl(pso: SO.Data.String, plugin: PluginContext): string | undefined {
    const theCell = plugin.state.data.selectQ(q => q.ofTransformer(Download)).find(cell => cell.obj === pso);
    const urlParam = theCell?.transform.params?.url;
    return urlParam ? Asset.getUrl(urlParam) : undefined;
}


/** Params for the `LoadMvsData` action */
const LoadMvsDataParams = {
    replaceExisting: PD.Boolean(false, { description: 'If true, the loaded MVS view will replace the current state; if false, the MVS view will be added to the current state.' }),
};

/** State action which loads a MVS view into Mol* */
export const LoadMvsData = StateAction.build({
    display: { name: 'Load MVS Data' },
    from: Mvs,
    params: LoadMvsDataParams,
})(({ a, params }, plugin: PluginContext) => Task.create('Load MVS Data', async () => {
    const { mvsData, sourceUrl } = a.data;
    await loadMVS(plugin, mvsData, { replaceExisting: params.replaceExisting, sourceUrl: sourceUrl });
}));


/** Data format provider for MVSJ format.
 * If Visuals:On, it will load the parsed MVS view;
 * otherwise it will just create a plugin state object with parsed data. */
export const MVSJFormatProvider: DataFormatProvider<{}, StateObjectRef<Mvs>, any> = DataFormatProvider({
    label: 'MVSJ',
    description: 'MVSJ',
    category: 'Miscellaneous',
    stringExtensions: ['mvsj'],
    parse: async (plugin, data) => {
        return plugin.state.data.build().to(data).apply(ParseMVSJ).commit();
    },
    visuals: async (plugin, data) => {
        const ref = StateObjectRef.resolveRef(data);
        const params = PD.getDefaultValues(LoadMvsDataParams);
        return await plugin.state.data.applyAction(LoadMvsData, params, ref).run();
    },
});
