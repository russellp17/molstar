/**
 * Copyright (c) 2018-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { PolymerBackboneCylinderVisual, PolymerBackboneCylinderParams } from '../visual/polymer-backbone-cylinder';
import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { UnitsRepresentation } from '../units-representation';
import { StructureRepresentation, StructureRepresentationProvider, StructureRepresentationStateBuilder } from '../representation';
import { Representation, RepresentationContext, RepresentationParamsGetter } from '../../../mol-repr/representation';
import { ThemeRegistryContext } from '../../../mol-theme/theme';
import { Structure } from '../../../mol-model/structure';
import { PolymerBackboneSphereParams, PolymerBackboneSphereVisual } from '../visual/polymer-backbone-sphere';

const BackboneVisuals = {
    'polymer-backbone-cylinder': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, PolymerBackboneCylinderParams>) => UnitsRepresentation('Polymer backbone cylinder', ctx, getParams, PolymerBackboneCylinderVisual),
    'polymer-backbone-sphere': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, PolymerBackboneSphereParams>) => UnitsRepresentation('Polymer backbone sphere', ctx, getParams, PolymerBackboneSphereVisual),
};

export const BackboneParams = {
    ...PolymerBackboneSphereParams,
    ...PolymerBackboneCylinderParams,
    sizeAspectRatio: PD.Numeric(1, { min: 0.1, max: 3, step: 0.1 }),
    visuals: PD.MultiSelect(['polymer-backbone-cylinder', 'polymer-backbone-sphere'], PD.objectToOptions(BackboneVisuals))
};
export type BackboneParams = typeof BackboneParams
export function getBackboneParams(ctx: ThemeRegistryContext, structure: Structure) {
    return PD.clone(BackboneParams);
}

export type BackboneRepresentation = StructureRepresentation<BackboneParams>
export function BackboneRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<Structure, BackboneParams>): BackboneRepresentation {
    return Representation.createMulti('Backbone', ctx, getParams, StructureRepresentationStateBuilder, BackboneVisuals as unknown as Representation.Def<Structure, BackboneParams>);
}

export const BackboneRepresentationProvider = StructureRepresentationProvider({
    name: 'backbone',
    label: 'Backbone',
    description: 'Displays polymer backbone with cylinders and spheres.',
    factory: BackboneRepresentation,
    getParams: getBackboneParams,
    defaultValues: PD.getDefaultValues(BackboneParams),
    defaultColorTheme: { name: 'chain-id' },
    defaultSizeTheme: { name: 'uniform' },
    isApplicable: (structure: Structure) => structure.elementCount > 0,
});