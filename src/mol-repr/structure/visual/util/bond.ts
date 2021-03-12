/**
 * Copyright (c) 2018-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { BondType } from '../../../../mol-model/structure/model/types';
import { Unit, StructureElement, Structure, Bond, ElementIndex } from '../../../../mol-model/structure';
import { ParamDefinition as PD } from '../../../../mol-util/param-definition';
import { LocationIterator } from '../../../../mol-geo/util/location-iterator';
import { StructureGroup } from '../../units-visual';
import { LinkCylinderParams, LinkLineParams } from './link';
import { ObjectKeys } from '../../../../mol-util/type-helpers';
import { PickingId } from '../../../../mol-geo/geometry/picking';
import { EmptyLoci, Loci } from '../../../../mol-model/loci';
import { Interval, OrderedSet, SortedArray } from '../../../../mol-data/int';
import { isH, isHydrogen } from './common';

export const BondParams = {
    includeTypes: PD.MultiSelect(ObjectKeys(BondType.Names), PD.objectToOptions(BondType.Names)),
    excludeTypes: PD.MultiSelect([] as BondType.Names[], PD.objectToOptions(BondType.Names)),
    ignoreHydrogens: PD.Boolean(false),
};
export const DefaultBondProps = PD.getDefaultValues(BondParams);
export type BondProps = typeof DefaultBondProps

export const BondCylinderParams = {
    ...LinkCylinderParams,
    ...BondParams
};
export const DefaultBondCylinderProps = PD.getDefaultValues(BondCylinderParams);
export type BondCylinderProps = typeof DefaultBondCylinderProps

export const BondLineParams = {
    ...LinkLineParams,
    ...BondParams
};
export const DefaultBondLineProps = PD.getDefaultValues(BondLineParams);
export type BondLineProps = typeof DefaultBondLineProps

export function ignoreBondType(include: BondType.Flag, exclude: BondType.Flag, f: BondType.Flag) {
    return !BondType.is(include, f) || BondType.is(exclude, f);
}

export function makeIntraBondIgnoreTest(unit: Unit.Atomic, props: BondProps): undefined | ((edgeIndex: number) => boolean) {
    const elements = unit.elements;
    const { atomicNumber } = unit.model.atomicHierarchy.derived.atom;
    const bonds = unit.bonds;
    const { a, b, edgeProps } = bonds;
    const { flags: _flags } = edgeProps;

    const { ignoreHydrogens, includeTypes, excludeTypes } = props;

    const include = BondType.fromNames(includeTypes);
    const exclude = BondType.fromNames(excludeTypes);

    const allBondTypes = BondType.isAll(include) && BondType.Flag.None === exclude;

    if (!allBondTypes && ignoreHydrogens) {
        return (edgeIndex: number) => isH(atomicNumber, elements[a[edgeIndex]]) || isH(atomicNumber, elements[b[edgeIndex]]) || ignoreBondType(include, exclude, _flags[edgeIndex]);
    } else if (!allBondTypes) {
        return (edgeIndex: number) => ignoreBondType(include, exclude, _flags[edgeIndex]);
    } else if (ignoreHydrogens) {
        return (edgeIndex: number) => isH(atomicNumber, elements[a[edgeIndex]]) || isH(atomicNumber, elements[b[edgeIndex]]);
    }
}

export function makeInterBondIgnoreTest(structure: Structure, props: BondProps): undefined | ((edgeIndex: number) => boolean) {
    const bonds = structure.interUnitBonds;
    const { edges } = bonds;

    const { ignoreHydrogens, includeTypes, excludeTypes } = props;

    const include = BondType.fromNames(includeTypes);
    const exclude = BondType.fromNames(excludeTypes);

    const allBondTypes = BondType.isAll(include) && BondType.Flag.None === exclude;

    const ignoreHydrogen = (edgeIndex: number) => {
        const b = edges[edgeIndex];
        const uA = structure.unitMap.get(b.unitA);
        const uB = structure.unitMap.get(b.unitB);
        return isHydrogen(uA, uA.elements[b.indexA]) || isHydrogen(uB, uB.elements[b.indexB]);
    };

    if (!allBondTypes && ignoreHydrogens) {
        return (edgeIndex: number) => ignoreHydrogen(edgeIndex) || ignoreBondType(include, exclude, edges[edgeIndex].props.flag);
    } else if (!allBondTypes) {
        return (edgeIndex: number) => ignoreBondType(include, exclude, edges[edgeIndex].props.flag);
    } else if (ignoreHydrogens) {
        return (edgeIndex: number) => ignoreHydrogen(edgeIndex);
    }
}

interface BondIndexMapping<T extends number> {
    /** Test 123 */
    indexFromParent: Map<number, number>
    parentFromIndex: Map<number, number>
    elementFromIndex: Map<number, T>
}

export function getIntraBondIndexMapping(parent: Unit.Atomic, child: Unit.Atomic): BondIndexMapping<ElementIndex> {
    const { edgeCount, a, b } = parent.bonds;
    const elements = parent.elements;

    const indexFromParent = new Map<number, number>();
    const parentFromIndex = new Map<number, number>();
    const elementFromIndex = new Map<number, ElementIndex>();

    let j = child.bonds.edgeCount * 2;
    for (let i = 0, il = edgeCount * 2; i < il; ++i) {
        const eA = elements[a[i]];
        const eB = elements[b[i]];
        const iA = SortedArray.indexOf(child.elements, eA) as StructureElement.UnitIndex;
        const iB = SortedArray.indexOf(child.elements, eB) as StructureElement.UnitIndex;
        let index: number = -1;
        if (iA !== -1 && iB !== -1) {
            index = child.bonds.getDirectedEdgeIndex(iA, iB);
        } else if (iA !== -1) {
            elementFromIndex.set(j, eA);
            index = j;
            j += 1;
        } else {
            continue;
        }
        indexFromParent.set(i, index);
        parentFromIndex.set(index, i);
    }
    return { indexFromParent, elementFromIndex, parentFromIndex };
}

export function getInterBondIndexMapping(parent: Structure, child: Structure): BondIndexMapping<Structure.SerialIndex> {
    const { edgeCount, edges } = parent.interUnitBonds;
    const { getSerialIndex } = child.serialMapping;

    const indexFromParent = new Map<number, number>();
    const parentFromIndex = new Map<number, number>();
    const elementFromIndex = new Map<number, Structure.SerialIndex>();

    let j = child.interUnitBonds.edgeCount;
    for (let i = 0, il = edgeCount; i < il; ++i) {
        const { indexA, unitA, indexB, unitB } = edges[i];
        let index = child.interUnitBonds.getEdgeIndex(indexA, unitA, indexB, unitB);
        if (index === -1) {
            const unit = child.unitMap.get(unitA);
            if (unit === undefined) continue;

            const eA = parent.unitMap.get(unitA).elements[indexA];
            const iA = SortedArray.indexOf(unit.elements, eA) as StructureElement.UnitIndex;
            if (iA === -1) continue;

            elementFromIndex.set(j, getSerialIndex(unit, unit.elements[iA]));
            index = j;
            j += 1;
        }
        indexFromParent.set(i, index);
        parentFromIndex.set(index, i);
    }
    return { indexFromParent, elementFromIndex, parentFromIndex };
}

export namespace BondIterator {
    export function fromGroup(structureGroup: StructureGroup): LocationIterator {
        const { group, structure } = structureGroup;
        const unit = group.units[0] as Unit.Atomic;
        const parentUnit = structure.root.unitMap.get(unit.id) as Unit.Atomic;
        const { indexFromParent, elementFromIndex } = getIntraBondIndexMapping(parentUnit, unit);

        const groupCount = Unit.isAtomic(unit) ? indexFromParent.size : 0;
        const instanceCount = group.units.length;
        const location = Bond.Location(structure, undefined, undefined, structure, undefined, undefined);
        const locE = StructureElement.Location.create(structure);
        const getLocation = (groupIndex: number, instanceIndex: number) => {
            const unit = group.units[instanceIndex] as Unit.Atomic;
            if (groupIndex >= unit.bonds.edgeCount * 2) {
                locE.unit = unit;
                locE.element = elementFromIndex.get(groupIndex)!;
                return locE;
            }
            location.aUnit = unit;
            location.bUnit = unit;
            location.aIndex = unit.bonds.a[groupIndex];
            location.bIndex = unit.bonds.b[groupIndex];
            return location;
        };
        return LocationIterator(groupCount, instanceCount, 1, getLocation);
    }

    export function fromStructure(structure: Structure): LocationIterator {
        const { indexFromParent, elementFromIndex } = getInterBondIndexMapping(structure.root, structure);

        const groupCount = indexFromParent.size;
        const instanceCount = 1;
        const location = Bond.Location(structure, undefined, undefined, structure, undefined, undefined);
        const locE = StructureElement.Location.create(structure);
        const getLocation = (groupIndex: number) => {
            if (groupIndex >= structure.interUnitBonds.edgeCount) {
                const serial = elementFromIndex.get(groupIndex)!;
                locE.unit = structure.units[structure.serialMapping.unitIndices[serial]];
                locE.element = structure.serialMapping.elementIndices[serial];
                return locE;
            }
            const bond = structure.interUnitBonds.edges[groupIndex];
            location.aUnit = structure.unitMap.get(bond.unitA);
            location.aIndex = bond.indexA;
            location.bUnit = structure.unitMap.get(bond.unitB);
            location.bIndex = bond.indexB;
            return location;
        };
        return LocationIterator(groupCount, instanceCount, 1, getLocation, true);
    }
}

//

export function getIntraBondLoci(pickingId: PickingId, structureGroup: StructureGroup, id: number) {
    let { objectId, instanceId, groupId } = pickingId;
    if (id === objectId) {
        let { structure, group } = structureGroup;
        let unit = group.units[instanceId];
        if (Unit.isAtomic(unit)) {
            if (groupId >= unit.bonds.edgeCount * 2) {
                const parentUnit = structure.root.unitMap.get(unit.id) as Unit.Atomic;
                const { parentFromIndex } = getIntraBondIndexMapping(parentUnit, unit);
                structure = structure.root;
                unit = parentUnit;
                groupId = parentFromIndex.get(groupId)!;
            }
            return Bond.Loci(structure, [
                Bond.Location(
                    structure, unit, unit.bonds.a[groupId] as StructureElement.UnitIndex,
                    structure, unit, unit.bonds.b[groupId] as StructureElement.UnitIndex
                ),
                Bond.Location(
                    structure, unit, unit.bonds.b[groupId] as StructureElement.UnitIndex,
                    structure, unit, unit.bonds.a[groupId] as StructureElement.UnitIndex
                )
            ]);
        }
    }
    return EmptyLoci;
}

export function eachIntraBond(loci: Loci, structureGroup: StructureGroup, apply: (interval: Interval) => boolean, isMarking: boolean) {
    let changed = false;
    if (Bond.isLoci(loci)) {
        const { structure, group } = structureGroup;
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        const unit = group.units[0];
        if (!Unit.isAtomic(unit)) return false;
        const parentUnit = structure.root.unitMap.get(unit.id) as Unit.Atomic;
        // TODO only use when available
        const { indexFromParent } = getIntraBondIndexMapping(parentUnit, unit);
        const groupCount = indexFromParent.size; // unit.bonds.edgeCount * 2;
        for (const b of loci.bonds) {
            if (b.aUnit !== b.bUnit) continue;
            const unitIdx = group.unitIndexMap.get(b.aUnit.id);
            if (unitIdx !== undefined) {
                let idx = unit.bonds.getDirectedEdgeIndex(b.aIndex, b.bIndex);
                if (idx === -1) {
                    idx = parentUnit.bonds.getDirectedEdgeIndex(b.aIndex, b.bIndex);
                    if (idx !== -1) {
                        idx = indexFromParent.get(idx) ?? -1;
                    }
                }
                if (idx !== -1) {
                    if (apply(Interval.ofSingleton(unitIdx * groupCount + idx))) changed = true;
                }
            }
        }
    } else if (StructureElement.Loci.is(loci)) {
        const { structure, group } = structureGroup;
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        const unit = group.units[0];
        if (!Unit.isAtomic(unit)) return false;
        const groupCount = unit.bonds.edgeCount * 2;
        for (const e of loci.elements) {
            const unitIdx = group.unitIndexMap.get(e.unit.id);
            if (unitIdx !== undefined) {
                const { offset, b } = unit.bonds;
                OrderedSet.forEach(e.indices, v => {
                    for (let t = offset[v], _t = offset[v + 1]; t < _t; t++) {
                        if (!isMarking || OrderedSet.has(e.indices, b[t])) {
                            if (apply(Interval.ofSingleton(unitIdx * groupCount + t))) changed = true;
                        }
                    }
                });
            }
        }
    }
    return changed;
}

//

export function getInterBondLoci(pickingId: PickingId, structure: Structure, id: number) {
    let { objectId, groupId } = pickingId;
    if (id === objectId) {
        if (groupId >= structure.interUnitBonds.edgeCount) {
            const { parentFromIndex } = getInterBondIndexMapping(structure.root, structure);
            structure = structure.root;
            groupId = parentFromIndex.get(groupId)!;
        }
        const b = structure.interUnitBonds.edges[groupId];
        const uA = structure.unitMap.get(b.unitA);
        const uB = structure.unitMap.get(b.unitB);
        return Bond.Loci(structure, [
            Bond.Location(structure, uA, b.indexA, structure, uB, b.indexB),
            Bond.Location(structure, uB, b.indexB, structure, uA, b.indexA)
        ]);
    }
    return EmptyLoci;
}

export function eachInterBond(loci: Loci, structure: Structure, apply: (interval: Interval) => boolean, isMarking: boolean) {
    let changed = false;
    if (Bond.isLoci(loci)) {
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        const { indexFromParent } = getInterBondIndexMapping(structure.root, structure);
        for (const b of loci.bonds) {
            let idx = structure.interUnitBonds.getBondIndexFromLocation(b);
            if (idx === -1) {
                idx = structure.root.interUnitBonds.getBondIndexFromLocation(b);
                if (idx !== -1) {
                    idx = indexFromParent.get(idx) ?? -1;
                }
            }
            if (idx !== -1) {
                if (apply(Interval.ofSingleton(idx))) changed = true;
            }
        }
    } else if (StructureElement.Loci.is(loci)) {
        if (!Structure.areEquivalent(loci.structure, structure)) return false;
        if (isMarking && loci.elements.length === 1) return false; // only a single unit

        const map = new Map<number, OrderedSet<StructureElement.UnitIndex>>();
        for (const e of loci.elements) map.set(e.unit.id, e.indices);

        for (const e of loci.elements) {
            const { unit } = e;
            if (!Unit.isAtomic(unit)) continue;
            structure.interUnitBonds.getConnectedUnits(unit.id).forEach(b => {
                const otherLociIndices = map.get(b.unitB);
                if (!isMarking || otherLociIndices) {
                    OrderedSet.forEach(e.indices, v => {
                        if (!b.connectedIndices.includes(v)) return;
                        b.getEdges(v).forEach(bi => {
                            if (!isMarking || (otherLociIndices && OrderedSet.has(otherLociIndices, bi.indexB))) {
                                const idx = structure.interUnitBonds.getEdgeIndex(v, unit.id, bi.indexB, b.unitB);
                                if (apply(Interval.ofSingleton(idx))) changed = true;
                            }
                        });
                    });
                }
            });
        }
    }
    return changed;
}